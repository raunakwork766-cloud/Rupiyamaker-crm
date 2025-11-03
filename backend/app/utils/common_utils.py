from fastapi import HTTPException, Query
from bson import ObjectId
from typing import Dict, Any, Optional
from pydantic import BeforeValidator
from typing_extensions import Annotated

def validate_object_id(v):
    """Validator function for ObjectId strings"""
    if not v or not isinstance(v, str) or not v.strip():
        raise ValueError("ObjectId cannot be empty")
    
    if not ObjectId.is_valid(v):
        raise ValueError(f"Invalid ObjectId format: {v}")
    return str(v)

# Pydantic v2 compatible ObjectId type
ObjectIdStr = Annotated[str, BeforeValidator(validate_object_id)]

class ObjectIdStrLegacy(str):
    """
    Legacy ObjectIdStr class - kept for backwards compatibility
    """
    @classmethod
    def is_valid(cls, v):
        return ObjectId.is_valid(v)

def get_current_user_id(user_id: str = Query(..., description="ID of the current user")) -> str:
    """
    FastAPI dependency to get the current user ID from query parameters.
    Used for authentication and authorization throughout the application.
    
    Args:
        user_id: The user ID passed as a query parameter
        
    Returns:
        The validated user ID string
        
    Raises:
        HTTPException: If user_id is not provided or invalid
    """
    if not user_id or not user_id.strip():
        raise HTTPException(
            status_code=400,
            detail="User ID is required"
        )
    
    # Validate that it's a proper ObjectId
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid user ID format: {user_id}"
        )
    
    return user_id

def convert_object_id(document: Dict[str, Any]) -> Dict[str, Any]:
    """Convert MongoDB document's ObjectId fields to strings and datetime to date for specific fields"""
    from datetime import datetime, date
    
    if not document:
        return None
        
    # Make a copy to avoid modifying the original
    doc_copy = {**document}
    
    # Fields that should be converted from datetime to date
    date_fields = {'dob', 'joining_date', 'date_of_birth'}
    
    # Convert all ObjectId fields to strings and handle date conversions
    for key, value in doc_copy.items():
        if isinstance(value, ObjectId):
            doc_copy[key] = str(value)
        elif isinstance(value, datetime) and key in date_fields:
            # Convert datetime to date for specific date fields
            doc_copy[key] = value.date()
        elif isinstance(value, dict):
            # Recursively convert nested dictionaries
            doc_copy[key] = convert_object_id(value)
        elif isinstance(value, list):
            # Handle lists that might contain ObjectIds or dictionaries
            doc_copy[key] = [
                convert_object_id(item) if isinstance(item, dict) else 
                str(item) if isinstance(item, ObjectId) else item
                for item in value
            ]
        
    return doc_copy

def convert_object_ids_in_list(documents: list) -> list:
    """Convert ObjectId fields to strings in a list of documents"""
    if not documents:
        return []
    
    return [convert_object_id(doc) for doc in documents]

async def generate_sequential_id(collection, id_field: str, prefix: str, padding: int = 4) -> str:
    """
    Generate a sequential ID with a prefix and padding.
    Example: generate_sequential_id(collection, "lead_id", "LEAD", 4) -> "LEAD0001"
    
    Args:
        collection: MongoDB collection to query
        id_field: Field name to store and check the ID
        prefix: Prefix for the ID (e.g., "LEAD", "PRD")
        padding: Number of digits to pad the numeric part
    
    Returns:
        A sequential ID string (e.g., "LEAD0001")
    """
    # Find the document with the highest existing ID
    query = {id_field: {"$regex": f"^{prefix}"}}
    sort = [(id_field, -1)]  # Sort by ID field in descending order
    
    # Get the last document
    last_doc = await collection.find_one(query, sort=sort)
    
    if last_doc and id_field in last_doc:
        # Extract the numeric part and increment
        last_id = last_doc[id_field]
        numeric_part = last_id[len(prefix):]
        try:
            next_num = int(numeric_part) + 1
        except ValueError:
            next_num = 1
    else:
        # No existing IDs, start with 1
        next_num = 1
    
    # Format the new ID with padding
    new_id = f"{prefix}{next_num:0{padding}d}"
    
    return new_id