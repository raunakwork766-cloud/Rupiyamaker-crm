from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from bson import ObjectId
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from app.config import Config
import pymongo

class ProductsDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.products_collection = self.db['products']
        self.form_sections_collection = self.db['product_form_sections']
        self.form_fields_collection = self.db['product_form_fields']
        self.form_submissions_collection = self.db['product_form_submissions']
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Create indexes for faster lookups
            await self.products_collection.create_index("name", unique=True, background=True)
            await self.products_collection.create_index("created_at", background=True)
            await self.products_collection.create_index([("is_active", 1)], background=True)
            await self.form_sections_collection.create_index([("product_id", 1), ("order", 1)], background=True)
            await self.form_fields_collection.create_index([("section_id", 1), ("order", 1)], background=True)
            await self.form_submissions_collection.create_index([("product_id", 1), ("created_at", -1)], background=True)
            await self.form_submissions_collection.create_index([("user_id", 1)], background=True)
            print("✓ Products database indexes created successfully")
        except Exception as e:
            print(f"Products index creation warning (may already exist): {e}")
    
    async def get_collection(self):
        """Get products collection for utility functions"""
        return self.products_collection
    
    async def get_submissions_collection(self):
        """Get form submissions collection for utility functions"""
        return self.form_submissions_collection
    
    # ========= Product CRUD Operations =========
    
    async def create_product(self, product_data: Dict) -> str:
        """Create a new product and return its ID"""
        result = await self.products_collection.insert_one(product_data)
        return str(result.inserted_id)
    
    async def get_product(self, product_id: str) -> Optional[Dict]:
        """Get a product by ID"""
        if not ObjectId.is_valid(product_id):
            return None
        
        return await self.products_collection.find_one({"_id": ObjectId(product_id)})
    
    async def get_product_by_code(self, product_code: str) -> Optional[Dict]:
        """Get a product by product code"""
        return await self.products_collection.find_one({"product_code": product_code})
    
    async def list_products(self, filter_dict: Dict = None, skip: int = 0, limit: int = 20, 
                      sort_by: str = "created_at", sort_order: int = -1) -> List[Dict]:
        """List products with pagination and filtering"""
        if filter_dict is None:
            filter_dict = {}
        
        # Convert string IDs to ObjectId where needed
        if "category" in filter_dict and ObjectId.is_valid(filter_dict["category"]):
            filter_dict["category"] = ObjectId(filter_dict["category"])
        
        # Set sort direction
        direction = pymongo.DESCENDING if sort_order == -1 else pymongo.ASCENDING
        
        # Query with pagination
        cursor = self.products_collection.find(filter_dict).sort(sort_by, direction).skip(skip).limit(limit)
        
        return await cursor.to_list(length=limit)
    
    async def count_products(self, filter_dict: Dict = None) -> int:
        """Count products based on filter"""
        if filter_dict is None:
            filter_dict = {}
        
        return await self.products_collection.count_documents(filter_dict)
    
    async def update_product(self, product_id: str, update_data: Dict) -> bool:
        """Update a product and return success status"""
        if not ObjectId.is_valid(product_id):
            return False
        
        result = await self.products_collection.update_one(
            {"_id": ObjectId(product_id)},
            {"$set": update_data}
        )
        
        return result.modified_count > 0
    
    async def delete_product(self, product_id: str) -> bool:
        """Delete a product and return success status"""
        if not ObjectId.is_valid(product_id):
            return False
        
        result = await self.products_collection.delete_one({"_id": ObjectId(product_id)})
        
        return result.deleted_count > 0
    
    # ========= Form Section CRUD Operations =========
    
    async def create_form_section(self, section_data: Dict) -> str:
        """Create a new form section and return its ID"""
        # If product_id is a string, convert to ObjectId
        if "product_id" in section_data and ObjectId.is_valid(section_data["product_id"]):
            section_data["product_id"] = ObjectId(section_data["product_id"])
        
        result = await self.form_sections_collection.insert_one(section_data)
        return str(result.inserted_id)
    
    async def get_form_section(self, section_id: str) -> Optional[Dict]:
        """Get a form section by ID"""
        if not ObjectId.is_valid(section_id):
            return None
        
        return await self.form_sections_collection.find_one({"_id": ObjectId(section_id)})
    
    async def list_form_sections(self, filter_dict: Dict = None) -> List[Dict]:
        """List form sections with filtering"""
        if filter_dict is None:
            filter_dict = {}
        
        # Convert string IDs to ObjectId where needed
        if "product_id" in filter_dict and ObjectId.is_valid(filter_dict["product_id"]):
            filter_dict["product_id"] = ObjectId(filter_dict["product_id"])
        
        # Query and sort by order
        cursor = self.form_sections_collection.find(filter_dict).sort("order", pymongo.ASCENDING)
        
        return await cursor.to_list()
    
    async def update_form_section(self, section_id: str, update_data: Dict) -> bool:
        """Update a form section and return success status"""
        if not ObjectId.is_valid(section_id):
            return False
        
        # If product_id is a string, convert to ObjectId
        if "product_id" in update_data and ObjectId.is_valid(update_data["product_id"]):
            update_data["product_id"] = ObjectId(update_data["product_id"])
        
        result = await self.form_sections_collection.update_one(
            {"_id": ObjectId(section_id)},
            {"$set": update_data}
        )
        
        return result.modified_count > 0
    
    async def delete_form_section(self, section_id: str) -> bool:
        """Delete a form section and return success status"""
        if not ObjectId.is_valid(section_id):
            return False
        
        # Delete the section
        result = await self.form_sections_collection.delete_one({"_id": ObjectId(section_id)})
        
        # Also delete any fields that were in this section
        if result.deleted_count > 0:
            await self.form_fields_collection.delete_many({"section_id": ObjectId(section_id)})
        
        return result.deleted_count > 0
    
    # ========= Form Field CRUD Operations =========
    
    async def create_form_field(self, field_data: Dict) -> str:
        """Create a new form field and return its ID"""
        # If section_id is a string, convert to ObjectId
        if "section_id" in field_data and ObjectId.is_valid(field_data["section_id"]):
            field_data["section_id"] = ObjectId(field_data["section_id"])
        
        result = await self.form_fields_collection.insert_one(field_data)
        return str(result.inserted_id)
    
    async def get_form_field(self, field_id: str) -> Optional[Dict]:
        """Get a form field by ID"""
        if not ObjectId.is_valid(field_id):
            return None
        
        return await self.form_fields_collection.find_one({"_id": ObjectId(field_id)})
    
    async def list_form_fields(self, section_id: Optional[str] = None, product_id: Optional[str] = None) -> List[Dict]:
        """
        List form fields with filtering
        
        Args:
            section_id: Optional ID of a specific section to filter by
            product_id: Optional ID of a product to get all fields for all its sections
        """
        filter_dict = {}
        
        # If section_id is provided, filter by that section
        if section_id:
            if ObjectId.is_valid(section_id):
                filter_dict["section_id"] = ObjectId(section_id)
            else:
                filter_dict["section_id"] = section_id
        
        # If product_id is provided, get all sections for that product, then all fields for those sections
        elif product_id and ObjectId.is_valid(product_id):
            # Get all sections for this product
            sections = self.list_form_sections({"product_id": ObjectId(product_id)})
            section_ids = [section["_id"] for section in sections]
            
            # Filter fields by these section IDs
            if section_ids:
                filter_dict["section_id"] = {"$in": section_ids}
            else:
                return []  # No sections found for this product
        
        # Query and sort by order
        cursor = self.form_fields_collection.find(filter_dict).sort("order", pymongo.ASCENDING)
        
        return await cursor.to_list()
    
    async def update_form_field(self, field_id: str, update_data: Dict) -> bool:
        """Update a form field and return success status"""
        if not ObjectId.is_valid(field_id):
            return False
        
        # If section_id is a string, convert to ObjectId
        if "section_id" in update_data and ObjectId.is_valid(update_data["section_id"]):
            update_data["section_id"] = ObjectId(update_data["section_id"])
        
        result = await self.form_fields_collection.update_one(
            {"_id": ObjectId(field_id)},
            {"$set": update_data}
        )
        
        return result.modified_count > 0
    
    async def delete_form_field(self, field_id: str) -> bool:
        """Delete a form field and return success status"""
        if not ObjectId.is_valid(field_id):
            return False
        
        result = await self.form_fields_collection.delete_one({"_id": ObjectId(field_id)})
        
        return result.deleted_count > 0
    
    # ========= Form Submission CRUD Operations =========
    
    async def create_form_submission(self, submission_data: Dict) -> str:
        """Create a new form submission and return its ID"""
        # Convert string IDs to ObjectId
        if "product_id" in submission_data and ObjectId.is_valid(submission_data["product_id"]):
            submission_data["product_id"] = ObjectId(submission_data["product_id"])
        
        if "lead_id" in submission_data and submission_data["lead_id"] and ObjectId.is_valid(submission_data["lead_id"]):
            submission_data["lead_id"] = ObjectId(submission_data["lead_id"])
        
        if "created_by" in submission_data and ObjectId.is_valid(submission_data["created_by"]):
            submission_data["created_by"] = ObjectId(submission_data["created_by"])
        
        if "updated_by" in submission_data and ObjectId.is_valid(submission_data["updated_by"]):
            submission_data["updated_by"] = ObjectId(submission_data["updated_by"])
        
        result = await self.form_submissions_collection.insert_one(submission_data)
        return str(result.inserted_id)
    
    async def get_form_submission(self, submission_id: str) -> Optional[Dict]:
        """Get a form submission by ID"""
        if not ObjectId.is_valid(submission_id):
            return None
        
        return await self.form_submissions_collection.find_one({"_id": ObjectId(submission_id)})
    
    async def get_form_submission_by_code(self, submission_code: str) -> Optional[Dict]:
        """Get a form submission by submission code"""
        return await self.form_submissions_collection.find_one({"submission_code": submission_code})
    
    async def list_form_submissions(self, filter_dict: Dict = None, skip: int = 0, limit: int = 20,
                             sort_by: str = "created_at", sort_order: int = -1) -> List[Dict]:
        """List form submissions with pagination and filtering"""
        if filter_dict is None:
            filter_dict = {}
        
        # Convert string IDs to ObjectId where needed
        for key in ["product_id", "lead_id", "created_by"]:
            if key in filter_dict and ObjectId.is_valid(filter_dict[key]):
                filter_dict[key] = ObjectId(filter_dict[key])
        
        # Set sort direction
        direction = pymongo.DESCENDING if sort_order == -1 else pymongo.ASCENDING
        
        # Query with pagination
        cursor = self.form_submissions_collection.find(filter_dict).sort(sort_by, direction).skip(skip).limit(limit)
        
        return await cursor.to_list(length=limit)
    
    async def count_form_submissions(self, filter_dict: Dict = None) -> int:
        """Count form submissions based on filter"""
        if filter_dict is None:
            filter_dict = {}
        
        # Convert string IDs to ObjectId where needed
        for key in ["product_id", "lead_id", "created_by"]:
            if key in filter_dict and ObjectId.is_valid(filter_dict[key]):
                filter_dict[key] = ObjectId(filter_dict[key])
        
        return await self.form_submissions_collection.count_documents(filter_dict)
    
    async def update_form_submission(self, submission_id: str, update_data: Dict) -> bool:
        """Update a form submission and return success status"""
        if not ObjectId.is_valid(submission_id):
            return False
        
        # Convert string IDs to ObjectId
        if "product_id" in update_data and ObjectId.is_valid(update_data["product_id"]):
            update_data["product_id"] = ObjectId(update_data["product_id"])
        
        if "lead_id" in update_data and update_data["lead_id"] and ObjectId.is_valid(update_data["lead_id"]):
            update_data["lead_id"] = ObjectId(update_data["lead_id"])
        
        if "updated_by" in update_data and ObjectId.is_valid(update_data["updated_by"]):
            update_data["updated_by"] = ObjectId(update_data["updated_by"])
        
        result = await self.form_submissions_collection.update_one(
            {"_id": ObjectId(submission_id)},
            {"$set": update_data}
        )
        
        return result.modified_count > 0
    
    async def delete_form_submission(self, submission_id: str) -> bool:
        """Delete a form submission and return success status"""
        if not ObjectId.is_valid(submission_id):
            return False
        
        result = await self.form_submissions_collection.delete_one({"_id": ObjectId(submission_id)})
        
        return result.deleted_count > 0
