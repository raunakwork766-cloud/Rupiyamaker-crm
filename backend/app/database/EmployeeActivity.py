from bson import ObjectId
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.config import Config
import pymongo

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
import pymongo

class EmployeeActivityDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.activity_collection = self.db["employee_activities"]
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Create indexes for better performance
            await self.activity_collection.create_index([("employee_id", 1), ("created_at", -1)])
            await self.activity_collection.create_index([("activity_type", 1)])
            await self.activity_collection.create_index([("created_by", 1)])
            print("✓ EmployeeActivity database indexes created successfully")
        except Exception as e:
            print(f"EmployeeActivity index creation warning (may already exist): {e}")

    async def log_activity(self, activity_data: Dict[str, Any]) -> str:
        """Log an activity for an employee"""
        activity_data["created_at"] = datetime.now()
        activity_data["updated_at"] = datetime.now()
        
        result = await self.activity_collection.insert_one(activity_data)
        return str(result.inserted_id)

    async def get_employee_activities(self, employee_id: str, limit: int = 100, offset: int = 0, activity_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get activities for a specific employee (IDs will be enriched in the API layer)"""
        filter_query = {"employee_id": employee_id}
        if activity_type:
            filter_query["activity_type"] = activity_type
            
        cursor = self.activity_collection.find(
            filter_query
        ).sort("created_at", pymongo.DESCENDING).skip(offset).limit(limit)
        
        activities = await cursor.to_list(length=limit)
        
        # Convert ObjectIds to strings and prepare for enrichment
        for activity in activities:
            activity["_id"] = str(activity["_id"])
            
            # Ensure timestamp is in correct format
            if activity.get("created_at") and not activity.get("timestamp"):
                activity["timestamp"] = activity["created_at"].isoformat() if hasattr(activity["created_at"], 'isoformat') else str(activity["created_at"])
                
        return activities

    async def get_all_activities(self, limit: int = 50, offset: int = 0, activity_type: Optional[str] = None, employee_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all activities across the system with optional filters (admin function)"""
        filter_query = {}
        
        if activity_type:
            filter_query["activity_type"] = activity_type
        
        if employee_id:
            filter_query["employee_id"] = employee_id
            
        cursor = self.activity_collection.find(
            filter_query
        ).sort("created_at", pymongo.DESCENDING).skip(offset).limit(limit)
        
        activities = await cursor.to_list(length=limit)
        
        # Convert ObjectIds to strings and prepare for enrichment
        for activity in activities:
            activity["_id"] = str(activity["_id"])
            
            # Ensure timestamp is in correct format
            if activity.get("created_at") and not activity.get("timestamp"):
                activity["timestamp"] = activity["created_at"].isoformat() if hasattr(activity["created_at"], 'isoformat') else str(activity["created_at"])
                
        return activities

    async def get_activity_by_id(self, activity_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific activity by ID"""
        try:
            activity = await self.activity_collection.find_one({"_id": ObjectId(activity_id)})
            if activity:
                activity["_id"] = str(activity["_id"])
            return activity
        except Exception:
            return None

    async def update_activity(self, activity_id: str, update_data: Dict[str, Any]) -> bool:
        """Update an activity"""
        try:
            update_data["updated_at"] = datetime.now()
            result = await self.activity_collection.update_one(
                {"_id": ObjectId(activity_id)},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except Exception:
            return False

    async def delete_activity(self, activity_id: str) -> bool:
        """Delete an activity"""
        try:
            result = await self.activity_collection.delete_one({"_id": ObjectId(activity_id)})
            return result.deleted_count > 0
        except Exception:
            return False

    def log_employee_creation(self, employee_id: str, created_by: str, employee_data: Dict[str, Any]):
        """Log employee creation activity with comprehensive details"""
        activity_data = {
            "employee_id": employee_id,
            "activity_type": "employee_created",
            "action": "employee_created",
            "description": f"Employee record created",
            "details": {
                "employee_info": {
                    "name": f"{employee_data.get('first_name', '')} {employee_data.get('last_name', '')}".strip(),
                    "employee_id": employee_data.get('employee_id'),
                    "email": employee_data.get('email'),
                    "phone": employee_data.get('phone'),
                    "department": employee_data.get('department_id'),
                    "role": employee_data.get('role_id'),
                    "designation": employee_data.get('designation'),
                    "joining_date": employee_data.get('joining_date'),
                    "employment_type": employee_data.get('employment_type'),
                    "status": employee_data.get('status', 'active')
                },
                "created_fields": list(employee_data.keys())
            },
            "created_by": created_by,
            "performed_by": created_by,
            "timestamp": datetime.now().isoformat()
        }
        return self.log_activity(activity_data)

    def log_employee_update(self, employee_id: str, updated_by: str, changes: Dict[str, Any], original_data: Dict[str, Any] = None):
        """Log employee update activity with detailed field changes"""
        from app.database.Users import UsersDB
        
        # Get original employee data if not provided
        if original_data is None:
            from app.database import get_database_instances
            db_instances = get_database_instances()
            users_db = db_instances['users']
            # Since this is sync context, we'll skip getting original data
            # and let the caller provide it
            original_data = {}
        
        # Track field changes with before/after values
        field_changes = {}
        field_labels = {
            'first_name': 'First Name',
            'last_name': 'Last Name',
            'email': 'Email Address',
            'phone': 'Phone Number',
            'dob': 'Date of Birth',
            'personal_email': 'Personal Email',
            'emergency_contact_name': 'Emergency Contact Name',
            'emergency_contact_phone': 'Emergency Contact Phone',
            'emergency_contact_relationship': 'Emergency Contact Relationship',
            'designation': 'Designation',
            'department_id': 'Department',
            'role_id': 'Role',
            'reporting_manager': 'Reporting Manager',
            'joining_date': 'Joining Date',
            'employment_type': 'Employment Type',
            'salary': 'Salary',
            'bank_account_number': 'Bank Account Number',
            'bank_name': 'Bank Name',
            'ifsc_code': 'IFSC Code',
            'pan_number': 'PAN Number',
            'aadhar_number': 'Aadhar Number',
            'address': 'Address',
            'status': 'Employee Status',
            'is_active': 'Login Status',
            'username': 'Username',
            'profile_photo': 'Profile Photo'
        }
        
        for field, new_value in changes.items():
            if field in ['updated_at', 'password', 'hashed_password']:
                continue  # Skip meta fields and sensitive data
                
            old_value = original_data.get(field)
            
            # Handle special cases
            if field == 'address' and isinstance(new_value, dict) and isinstance(old_value, dict):
                # Track address subfield changes
                address_changes = {}
                for addr_field, addr_new_val in new_value.items():
                    addr_old_val = old_value.get(addr_field) if old_value else None
                    if addr_old_val != addr_new_val:
                        address_changes[addr_field] = {
                            'from': addr_old_val,
                            'to': addr_new_val
                        }
                if address_changes:
                    field_changes[field] = {
                        'label': field_labels.get(field, field.replace('_', ' ').title()),
                        'changes': address_changes
                    }
            elif old_value != new_value:
                field_changes[field] = {
                    'label': field_labels.get(field, field.replace('_', ' ').title()),
                    'from': old_value,
                    'to': new_value
                }
        
        # Generate human-readable description
        if len(field_changes) == 1:
            field_name = list(field_changes.keys())[0]
            field_label = field_changes[field_name]['label']
            description = f"Updated {field_label}"
        elif len(field_changes) <= 3:
            field_labels_list = [field_changes[field]['label'] for field in field_changes.keys()]
            description = f"Updated {', '.join(field_labels_list)}"
        else:
            description = f"Updated {len(field_changes)} fields"
        
        activity_data = {
            "employee_id": employee_id,
            "activity_type": "profile_updated",
            "action": "profile_updated",
            "description": description,
            "details": {
                "field_changes": field_changes,
                "total_fields_changed": len(field_changes),
                "raw_changes": changes
            },
            "created_by": updated_by,
            "performed_by": updated_by,
            "timestamp": datetime.now().isoformat()
        }
        return self.log_activity(activity_data)

    def log_status_change(self, employee_id: str, updated_by: str, old_status: str, new_status: str, remark: Optional[str] = None):
        """Log employee status change activity"""
        activity_data = {
            "employee_id": employee_id,
            "activity_type": "status_changed",
            "action": "status_changed",
            "description": f"Status changed from {old_status} to {new_status}",
            "details": {
                "status_change": {
                    "from": old_status,
                    "to": new_status,
                    "remark": remark
                }
            },
            "created_by": updated_by,
            "performed_by": updated_by,
            "timestamp": datetime.now().isoformat()
        }
        return self.log_activity(activity_data)

    def log_attachment_upload(self, employee_id: str, uploaded_by: str, attachment_data: Dict[str, Any]):
        """Log attachment upload activity"""
        activity_data = {
            "employee_id": employee_id,
            "activity_type": "attachment_uploaded",
            "action": "attachment_uploaded",
            "description": f"Uploaded {attachment_data.get('file_name', 'file')}",
            "details": {
                "file_info": {
                    "file_name": attachment_data.get('file_name'),
                    "file_type": attachment_data.get('file_type'),
                    "attachment_type": attachment_data.get('attachment_type'),
                    "file_size": attachment_data.get('file_size'),
                    "file_path": attachment_data.get('file_path')
                }
            },
            "created_by": uploaded_by,
            "performed_by": uploaded_by,
            "timestamp": datetime.now().isoformat()
        }
        return self.log_activity(activity_data)

    def log_attachment_delete(self, employee_id: str, deleted_by: str, attachment_data: Dict[str, Any]):
        """Log attachment deletion activity"""
        activity_data = {
            "employee_id": employee_id,
            "activity_type": "attachment_deleted",
            "action": "attachment_deleted",
            "description": f"Deleted {attachment_data.get('file_name', 'file')}",
            "details": {
                "file_info": {
                    "file_name": attachment_data.get('file_name'),
                    "file_type": attachment_data.get('file_type'),
                    "attachment_type": attachment_data.get('attachment_type')
                }
            },
            "created_by": deleted_by,
            "performed_by": deleted_by,
            "timestamp": datetime.now().isoformat()
        }
        return self.log_activity(activity_data)

    def log_remark_added(self, employee_id: str, added_by: str, remark_text: str):
        """Log remark addition activity"""
        activity_data = {
            "employee_id": employee_id,
            "activity_type": "remark_added",
            "action": "remark_added",
            "description": "Added remark",
            "details": {
                "remark": {
                    "text": remark_text[:100] + "..." if len(remark_text) > 100 else remark_text,
                    "full_length": len(remark_text)
                }
            },
            "created_by": added_by,
            "performed_by": added_by,
            "timestamp": datetime.now().isoformat()
        }
        return self.log_activity(activity_data)

    def log_password_change(self, employee_id: str, changed_by: str):
        """Log password change activity"""
        activity_data = {
            "employee_id": employee_id,
            "activity_type": "password_changed",
            "action": "password_changed",
            "description": "Password changed",
            "details": {
                "security_action": "password_update"
            },
            "created_by": changed_by,
            "performed_by": changed_by,
            "timestamp": datetime.now().isoformat()
        }
        return self.log_activity(activity_data)

    def log_login_status_change(self, employee_id: str, changed_by: str, enabled: bool):
        """Log login status change activity"""
        activity_data = {
            "employee_id": employee_id,
            "activity_type": "login_status_changed",
            "action": "login_status_changed", 
            "description": f"Login {'enabled' if enabled else 'disabled'}",
            "details": {
                "login_change": {
                    "status": "enabled" if enabled else "disabled",
                    "is_active": enabled
                }
            },
            "created_by": changed_by,
            "performed_by": changed_by,
            "timestamp": datetime.now().isoformat()
        }
        return self.log_activity(activity_data)

    def log_photo_upload(self, employee_id: str, uploaded_by: str, photo_path: str):
        """Log profile photo upload activity"""
        activity_data = {
            "employee_id": employee_id,
            "activity_type": "photo_uploaded",
            "action": "photo_uploaded",
            "description": "Profile photo updated",
            "details": {
                "photo_info": {
                    "file_path": photo_path,
                    "action": "upload"
                }
            },
            "created_by": uploaded_by,
            "performed_by": uploaded_by,
            "timestamp": datetime.now().isoformat()
        }
        return self.log_activity(activity_data)
