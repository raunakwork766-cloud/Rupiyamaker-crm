from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from typing import List, Dict, Optional, Any
from bson import ObjectId
from datetime import datetime

class DepartmentsDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db["departments"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Create indexes for faster lookups
            await self.collection.create_index("name", unique=True, background=True)
            # ⚡ PERFORMANCE INDEXES for faster queries
            await self.collection.create_index([("parent_id", 1)], sparse=True, background=True)
            await self.collection.create_index([("is_active", 1)], background=True)
            print("✓ Departments database indexes created successfully")
        except Exception as e:
            print(f"DepartmentsDB index creation warning: {e}")
        
    async def create_department(self, department: dict) -> str:
        """Create a new department with timestamps"""
        department["created_at"] = datetime.now()
        department["updated_at"] = department["created_at"]
        
        # Set parent_id to None if not provided
        if "parent_id" not in department:
            department["parent_id"] = None
            
        result = await self.collection.insert_one(department)
        return str(result.inserted_id)
    
    async def get_department(self, dept_id: str) -> Optional[dict]:
        """Get a department by its ID"""
        if not ObjectId.is_valid(dept_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(dept_id)})
        
    async def get_department_by_name(self, name: str) -> Optional[dict]:
        """Get a department by its name"""
        return await self.collection.find_one({"name": name})
        
    async def list_departments(self, filter_dict: dict = None, projection: dict = None) -> List[dict]:
        """⚡ OPTIMIZED: List all departments with optional filtering and projection"""
        filter_dict = filter_dict or {}
        cursor = self.collection.find(filter_dict, projection)
        departments = await cursor.to_list(None)
        # Convert ObjectIds to strings
        for dept in departments:
            dept["_id"] = str(dept["_id"])
            if "parent_department_id" in dept and dept["parent_department_id"]:
                dept["parent_department_id"] = str(dept["parent_department_id"])
        return departments
    
    async def get_departments_batch(self, dept_ids: List[str]) -> Dict[str, dict]:
        """
        ⚡ OPTIMIZED: Batch fetch multiple departments by IDs
        
        Args:
            dept_ids: List of department ID strings
            
        Returns:
            Dictionary mapping dept_id to department document
        """
        try:
            # Convert string IDs to ObjectIds
            object_ids = [ObjectId(did) for did in dept_ids if ObjectId.is_valid(did)]
            
            if not object_ids:
                return {}
            
            # Batch fetch all departments in one query
            cursor = self.collection.find({"_id": {"$in": object_ids}})
            departments = await cursor.to_list(None)
            
            # Return as dictionary for O(1) lookups
            return {str(dept["_id"]): dept for dept in departments}
        except Exception as e:
            print(f"Error in batch fetch departments: {e}")
            return {}
        
    async def get_sub_departments(self, department_id: str) -> List[dict]:
        """Get all sub-departments for a specific department"""
        if not ObjectId.is_valid(department_id):
            return []
        cursor = self.collection.find({"parent_department_id": department_id})
        departments = await cursor.to_list(None)
        # Convert ObjectIds to strings
        for dept in departments:
            dept["_id"] = str(dept["_id"])
            if "parent_department_id" in dept and dept["parent_department_id"]:
                dept["parent_department_id"] = str(dept["parent_department_id"])
        return departments
        
    async def update_department(self, dept_id: str, update_fields: dict) -> bool:
        """Update a department with timestamp"""
        if not ObjectId.is_valid(dept_id):
            return False
            
        update_fields["updated_at"] = datetime.now()
        result = await self.collection.update_one(
            {"_id": ObjectId(dept_id)},
            {"$set": update_fields}
        )
        return result.modified_count == 1
        
    async def delete_department(self, dept_id: str) -> bool:
        """Delete a department by ID"""
        if not ObjectId.is_valid(dept_id):
            return False
        result = await self.collection.delete_one({"_id": ObjectId(dept_id)})
        return result.deleted_count == 1
        
    async def get_child_departments(self, parent_id: str) -> List[dict]:
        """Get all departments that are direct children of the given parent"""
        if not ObjectId.is_valid(parent_id) and parent_id is not None:
            return []
            
        parent_obj_id = ObjectId(parent_id) if parent_id else None
        return await self._async_to_list(self.collection.find({"parent_id": parent_obj_id}))
        
    async def get_all_descendant_departments(self, parent_id: str) -> List[dict]:
        """
        Recursively get all descendant departments (children, grandchildren, etc.)
        """
        if not ObjectId.is_valid(parent_id) and parent_id is not None:
            return []
            
        all_descendants = []
        direct_children = self.get_child_departments(parent_id)
        
        all_descendants.extend(direct_children)
        
        for child in direct_children:
            child_descendants = self.get_all_descendant_departments(str(child["_id"]))
            all_descendants.extend(child_descendants)
            
        return all_descendants
        
    async def get_department_hierarchy(self) -> List[dict]:
        """
        Return departments in hierarchy format.
        Root departments first (parent_id=None), then organized by parent.
        """
        # Get root departments
        root_departments = self.list_departments({"parent_id": None})
        
        # For each root, recursively get children
        result = []
        for dept in root_departments:
            dept_with_children = self._add_children_to_department(dept)
            result.append(dept_with_children)
            
        return result
        
    def _add_children_to_department(self, department: dict) -> dict:
        """Helper method to recursively add children to a department"""
        # Make a copy to avoid modifying the original
        dept_copy = {**department}
        
        # Convert ObjectId to string for the _id
        if "_id" in dept_copy and isinstance(dept_copy["_id"], ObjectId):
            dept_copy["_id"] = str(dept_copy["_id"])
            
        # Get direct children
        children = self.get_child_departments(str(department["_id"]))
        
        # If there are children, add them
        if children:
            # Add children with their own children
            dept_copy["children"] = [
                self._add_children_to_department(child)
                for child in children
            ]
        else:
            dept_copy["children"] = []
            
        return dept_copy

# Create a singleton instance for the application
departments_db = DepartmentsDB()