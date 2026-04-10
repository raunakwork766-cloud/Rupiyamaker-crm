from typing import Any, Optional
from bson import ObjectId
from pydantic import BaseModel, Field

# Simple function to convert string to ObjectId
def to_object_id(value):
    """Convert string to ObjectId if possible"""
    if isinstance(value, ObjectId):
        return value
    if isinstance(value, str) and ObjectId.is_valid(value):
        return ObjectId(value)
    return None

# For Pydantic models, use str types for ObjectId fields
# and convert them in your service methods
class PyObjectId(str):
    """
    String-based ObjectId class for Pydantic that serializes/deserializes to strings.
    """
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v):
        if not v:
            return None
        if isinstance(v, ObjectId):
            return str(v)
        if isinstance(v, str):
            if ObjectId.is_valid(v):
                return v
            raise ValueError("Invalid ObjectId format")
        raise ValueError(f"Cannot convert {type(v)} to ObjectId")

def convert_object_ids(obj: dict) -> dict:
    """
    Convert string IDs to ObjectIds in a dictionary
    """
    if not obj:
        return obj
        
    result = {}
    for key, value in obj.items():
        if key.endswith('_id') and isinstance(value, str) and ObjectId.is_valid(value):
            result[key] = ObjectId(value)
        elif isinstance(value, dict):
            result[key] = convert_object_ids(value)
        elif isinstance(value, list):
            result[key] = [
                convert_object_ids(item) if isinstance(item, dict) else 
                ObjectId(item) if isinstance(item, str) and ObjectId.is_valid(item) else item
                for item in value
            ]
        else:
            result[key] = value
            
    return result
