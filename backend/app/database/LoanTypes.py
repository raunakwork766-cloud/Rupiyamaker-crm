from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from bson import ObjectId
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from app.config import Config
import pymongo

class LoanTypesDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.loan_types_collection = self.db['loan_types']
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Create indexes for faster lookups
            # Use explicit index names to avoid conflicts
            await self.loan_types_collection.create_index("name", unique=True, name="loan_types_name_unique")
            await self.loan_types_collection.create_index("created_at", name="loan_types_created_at")
            print("✓ LoanTypes database indexes created successfully")
        except Exception as e:
            print(f"LoanTypes index creation warning (may already exist): {e}")
    
    async def get_collection(self):
        """Get loan types collection for utility functions"""
        return self.loan_types_collection
    
    # ========= Loan Type CRUD Operations =========
    
    async def create_loan_type(self, loan_type_data: Dict) -> str:
        """Create a new loan type and return its ID"""
        loan_type_data['created_at'] = datetime.now()
        loan_type_data['updated_at'] = datetime.now()
        result = await self.loan_types_collection.insert_one(loan_type_data)
        return str(result.inserted_id)
    
    async def get_loan_type(self, loan_type_id: str) -> Optional[Dict]:
        """Get a loan type by ID"""
        if not ObjectId.is_valid(loan_type_id):
            return None
        
        return await self.loan_types_collection.find_one({"_id": ObjectId(loan_type_id)})
    
    async def get_loan_type_by_name(self, name: str) -> Optional[Dict]:
        """Get a loan type by name"""
        return await self.loan_types_collection.find_one({"name": name})
    
    async def list_loan_types(self, filter_dict: Dict = None, skip: int = 0, limit: int = 100, 
                       sort_by: str = "name", sort_order: int = 1) -> List[Dict]:
        """List loan types with pagination and filtering"""
        if filter_dict is None:
            filter_dict = {}
        
        # Set sort direction
        sort_direction = pymongo.ASCENDING if sort_order == 1 else pymongo.DESCENDING
        
        cursor = self.loan_types_collection.find(filter_dict).sort(sort_by, sort_direction)
        
        if skip > 0:
            cursor = cursor.skip(skip)
        if limit > 0:
            cursor = cursor.limit(limit)
            
        return await cursor.to_list(length=limit)
    
    async def update_loan_type(self, loan_type_id: str, update_data: Dict) -> bool:
        """Update a loan type"""
        if not ObjectId.is_valid(loan_type_id):
            return False
        
        update_data['updated_at'] = datetime.now()
        result = await self.loan_types_collection.update_one(
            {"_id": ObjectId(loan_type_id)},
            {"$set": update_data}
        )
        return result.modified_count > 0
    
    async def delete_loan_type(self, loan_type_id: str) -> bool:
        """Delete a loan type"""
        if not ObjectId.is_valid(loan_type_id):
            return False
        
        result = await self.loan_types_collection.delete_one({"_id": ObjectId(loan_type_id)})
        return result.deleted_count > 0
    
    async def count_loan_types(self, filter_dict: Dict = None) -> int:
        """Count loan types matching the filter"""
        if filter_dict is None:
            filter_dict = {}
        
        return await self.loan_types_collection.count_documents(filter_dict)
    
    async def loan_type_exists(self, name: str, exclude_id: str = None) -> bool:
        """Check if a loan type with given name already exists"""
        filter_dict = {"name": {"$regex": f"^{name}$", "$options": "i"}}  # Case insensitive
        
        if exclude_id and ObjectId.is_valid(exclude_id):
            filter_dict["_id"] = {"$ne": ObjectId(exclude_id)}
        
        return await self.loan_types_collection.count_documents(filter_dict) > 0
    
    async def initialize_default_loan_types(self):
        """Initialize default loan types if collection is empty"""
        if await self.count_loan_types() > 0:
            return  # Already has data
        
        default_loan_types = [
            {
                "name": "Home Loan",
                "description": "Loan for purchasing or constructing a home",
                "status": "active",
                "is_default": True
            },
            {
                "name": "PL & OD",
                "description": "Unsecured personal loan for various purposes",
                "status": "active",
                "is_default": True
            }
        ]
        
        for loan_type in default_loan_types:
            await self.create_loan_type(loan_type)
        
        print(f"Initialized {len(default_loan_types)} default loan types")
