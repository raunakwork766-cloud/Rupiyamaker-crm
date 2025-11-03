from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from app.utils.permission_helpers import is_super_admin_permission
from typing import List, Dict, Optional, Any
from bson import ObjectId
from datetime import datetime

class RolesDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db["roles"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Create indexes for faster lookups
            await self.collection.create_index("name", unique=True, background=True)
            # ⚡ PERFORMANCE INDEXES for faster queries
            await self.collection.create_index([("is_active", 1)], background=True)
            await self.collection.create_index([("reporting_id", 1)], sparse=True, background=True)
            print("✓ Roles database indexes created successfully")
        except Exception as e:
            print(f"RolesDB index creation warning: {e}")

    async def count_roles(self, filter_dict: dict = None) -> int:
        """Count the number of roles with optional filtering"""
        filter_dict = filter_dict or {}
        return await self.collection.count_documents(filter_dict)

    async def _async_to_list(self, cursor):
        """Convert async Motor cursor to list"""
        return await cursor.to_list(None)
    
    
    async def create_role(self, role: dict) -> str:
        """Create a new role with timestamps"""
        role["created_at"] = datetime.now()
        role["updated_at"] = role["created_at"]
        
        # Set reporting_id to None if not provided
        if "reporting_id" not in role:
            role["reporting_id"] = None
            
        result = await self.collection.insert_one(role)
        return str(result.inserted_id)
    
    async def get_role(self, role_id: str) -> Optional[dict]:
        """Get a role by its ID"""
        if not ObjectId.is_valid(role_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(role_id)})

    async def get_role_by_name(self, name: str) -> Optional[dict]:
        """Get a role by its name"""
        return await self.collection.find_one({"name": name})

    async def list_roles(self, filter_dict: dict = None) -> List[dict]:
        """List all roles with optional filtering"""
        filter_dict = filter_dict or {}
        return await self._async_to_list(self.collection.find(filter_dict))

    async def update_role(self, role_id: str, update_fields: dict) -> bool:
        """Update a role with timestamp"""
        if not ObjectId.is_valid(role_id):
            return False
            
        update_fields["updated_at"] = datetime.now()
        result = await self.collection.update_one(
            {"_id": ObjectId(role_id)},
            {"$set": update_fields}
        )
        return result.modified_count == 1
    
    async def delete_role(self, role_id: str) -> bool:
        """Delete a role by ID"""
        if not ObjectId.is_valid(role_id):
            return False
        result = await self.collection.delete_one({"_id": ObjectId(role_id)})
        return result.deleted_count == 1

    async def get_permissions_config(self) -> List[Dict]:
        """
        Return all available pages/modules and possible actions.
        Updated to use simplified 3-type permission system: own, junior, all
        """
        return [
            {"page": "*", "actions": ["*"]},  # Super Admin - All pages and actions
            {"page": "warnings", "actions": ["own", "junior", "all"]},
            {"page": "users", "actions": ["own", "junior", "all"]},
            {"page": "attendance", "actions": ["own", "junior", "all"]},
            {"page": "leaves", "actions": ["own", "junior", "all"]},
            {"page": "leads", "actions": ["own", "junior", "all", "download_obligation"]},
            {"page": "tickets", "actions": ["own", "junior", "all"]},
            {"page": "interviews", "actions": ["own", "junior", "all"]},
            {"page": "reports", "actions": ["own", "junior", "all"]},
            {"page": "hrms", "actions": ["own", "junior", "all"]},
            {"page": "tasks", "actions": ["own", "junior", "all"]},
            {"page": "calculators", "actions": ["show", "use"]},  # Special case - no hierarchy needed
            {"page": "settings", "actions": ["show", "create", "edit", "delete"]},  # Admin-only
            {"page": "departments", "actions": ["show", "add", "edit", "delete"]},  # Admin-only
            {"page": "teams", "actions": ["show", "add", "edit", "delete"]},  # Admin-only
            {"page": "roles", "actions": ["show", "add", "edit", "delete"]},  # Admin-only
        ]

    async def check_permission(self, role_id: str, page: str, action: str) -> bool:
        """
        Check if a role has permission for a specific action on a page
        Also handles wildcards for both page and actions
        """
        if not ObjectId.is_valid(role_id):
            return False
        
        # First check for exact match or wildcard action    
        role = await self.collection.find_one({
            "_id": ObjectId(role_id),
            "$or": [
                # Check for exact page and exact action
                {
                    "permissions": {
                        "$elemMatch": {
                            "page": page,
                            "actions": action
                        }
                    }
                },
                # Check for exact page and wildcard action
                {
                    "permissions": {
                        "$elemMatch": {
                            "page": page,
                            "actions": "*"
                        }
                    }
                },
                # Check for wildcard page and exact action
                {
                    "permissions": {
                        "$elemMatch": {
                            "page": "*",
                            "actions": action
                        }
                    }
                },
                # Check for wildcard page and wildcard action
                {
                    "permissions": {
                        "$elemMatch": {
                            "page": "*",
                            "actions": "*"
                        }
                    }
                }
            ]
        })
        return role is not None
        
    async def get_direct_reports(self, role_id: str) -> List[dict]:
        """Get all roles that directly report to this role"""
        print(f"DEBUG: Getting direct reports for role_id {role_id}")
        if not ObjectId.is_valid(role_id):
            print(f"DEBUG: Invalid role_id format: {role_id}")
            return []
            
        # Handle both string and ObjectId formats
        object_role_id = ObjectId(role_id)
        reports = await self._async_to_list(self.collection.find({
            "$or": [
                {"reporting_id": role_id},         # String ID format
                {"reporting_id": object_role_id}   # ObjectId format
            ]
        }))
        
        print(f"DEBUG: Found {len(reports)} direct reports for role {role_id}")
        return reports
        
    # This is a duplicate implementation that's being removed.
    # The full implementation below will be used instead.
        
    async def get_all_subordinate_roles(self, role_id: str) -> List[dict]:
        """
        Get all roles that report to this role (any level deep)
        
        Args:
            role_id: Role ID to find subordinates for
            
        Returns:
            List[dict]: List of role documents that report to this role
        """
        print(f"DEBUG: Getting subordinate roles for role_id {role_id}")
        if not ObjectId.is_valid(role_id):
            print(f"DEBUG: Invalid role_id format: {role_id}")
            return []
            
        # Get direct reports first - look for both string and ObjectId formats
        object_role_id = ObjectId(role_id)
        direct_reports = await self._async_to_list(self.collection.find({
            "$or": [
                {"reporting_id": role_id},
                {"reporting_id": object_role_id}
            ]
        }))
        
        print(f"DEBUG: Found {len(direct_reports)} direct reports for role {role_id}")
        
        # If no direct reports, return empty list
        if not direct_reports:
            return []
            
        # Add all roles that report to the direct reports
        all_subordinates = list(direct_reports)  # Start with direct reports
        
        for report in direct_reports:
            report_id = str(report["_id"])
            print(f"DEBUG: Recursively checking subordinates for role {report_id}")
            subordinates = await self.get_all_subordinate_roles(report_id)  # Recursive call with await
            print(f"DEBUG: Found {len(subordinates)} subordinates for role {report_id}")
            all_subordinates.extend(subordinates)
            
        print(f"DEBUG: Total of {len(all_subordinates)} subordinate roles for {role_id}")
        return all_subordinates
    
    async def get_reporting_chain(self, role_id: str) -> List[dict]:
        """
        Get the chain of roles this role reports to (up the hierarchy)
        Returns ordered list from immediate manager to top level
        """
        if not ObjectId.is_valid(role_id):
            return []
            
        chain = []
        current_role = await self.get_role(role_id)
        
        while current_role and current_role.get("reporting_id"):
            manager_role = await self.get_role(current_role["reporting_id"])
            if manager_role:
                chain.append(manager_role)
                current_role = manager_role
            else:
                break
                
        return chain
        
    async def get_role_hierarchy(self) -> List[dict]:
        """
        Return roles in hierarchy format.
        Top roles first (reporting_id=None), then organized by reporting structure.
        """
        # Get top roles (no reporting_id)
        top_roles = self.list_roles({"reporting_id": None})
        
        # For each top role, recursively get subordinates
        result = []
        for role in top_roles:
            role_with_reports = self._add_reports_to_role(role)
            result.append(role_with_reports)
            
        return result
        
    def _add_reports_to_role(self, role: dict) -> dict:
        """Helper method to recursively add direct reports to a role"""
        # Make a copy to avoid modifying the original
        role_copy = {**role}
        
        # Convert ObjectId to string
        if "_id" in role_copy and isinstance(role_copy["_id"], ObjectId):
            role_copy["_id"] = str(role_copy["_id"])
            
        # Get direct reports
        reports = self.get_direct_reports(str(role["_id"]))
        
        # If there are reports, add them
        if reports:
            # Add reports with their own reports
            role_copy["direct_reports"] = [
                self._add_reports_to_role(report)
                for report in reports
            ]
        else:
            role_copy["direct_reports"] = []
            
        return role_copy

    async def update_role_permissions(self, role_id: str, permissions: List[dict]) -> bool:
        """Update permissions for a specific role"""
        if not ObjectId.is_valid(role_id):
            return False
        
        update_fields = {
            "permissions": permissions,
            "updated_at": datetime.now()
        }
        
        result = await self.collection.update_one(
            {"_id": ObjectId(role_id)},
            {"$set": update_fields}
        )
        
        return result.modified_count > 0

    async def get_all_roles(self) -> List[dict]:
        """Get all roles for permission management"""
        return await self._async_to_list(self.collection.find({}))

    async def get_all_roles_with_hierarchy(self) -> List[dict]:
        """Get all roles with their hierarchical structure for permission management"""
        roles = await self._async_to_list(self.collection.find({}))
        # Add hierarchy information to each role
        for role in roles:
            role = self._add_reports_to_role(role)
        return roles

    async def create_super_admin_role(self, role_name: str = "Super Admin") -> str:
        """Create a super admin role with full permissions (page: *, actions: *)"""
        try:
            # Check if super admin role already exists
            existing_role = self.get_role_by_name(role_name)
            if existing_role:
                return str(existing_role["_id"])
            
            # Create super admin role with wildcard permissions
            super_admin_role = {
                "name": role_name,
                "description": "Super Administrator with full system access",
                "permissions": [
                    {
                        "page": "*",
                        "actions": "*"
                    }
                ],
                "reporting_id": None,  # Top level role
                "is_super_admin": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            
            result = await self.collection.insert_one(super_admin_role)
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error creating super admin role: {e}")
            return None

    async def ensure_super_admin_permissions(self, role_id: str) -> bool:
        """Ensure a role has super admin permissions (page: *, actions: *)"""
        if not ObjectId.is_valid(role_id):
            return False
        
        super_admin_permissions = [
            {
                "page": "*",
                "actions": "*"
            }
        ]
        
        update_fields = {
            "permissions": super_admin_permissions,
            "is_super_admin": True,
            "updated_at": datetime.now()
        }
        
        result = await self.collection.update_one(
            {"_id": ObjectId(role_id)},
            {"$set": update_fields}
        )
        
        return result.modified_count > 0

    async def is_super_admin_role(self, role_id: str) -> bool:
        """Check if a role is a super admin role"""
        if not ObjectId.is_valid(role_id):
            return False
        
        role = await self.collection.find_one({"_id": ObjectId(role_id)})
        if not role:
            return False
        
        # Check if role has super admin permissions
        permissions = role.get("permissions", [])
        for perm in permissions:
            if is_super_admin_permission(perm):
                return True
        
        return False