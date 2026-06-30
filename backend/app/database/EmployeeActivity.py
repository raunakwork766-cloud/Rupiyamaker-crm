from bson import ObjectId
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.config import Config
from app.utils.timezone import get_ist_now
import pymongo

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
import pymongo

class EmployeeActivityDB:
    FIELD_LABELS = {
        'first_name': 'First Name',
        'last_name': 'Last Name',
        'email': 'Email Address',
        'phone': 'Phone Number',
        'alternate_phone': 'Alternate Phone',
        'work_email': 'Work Email',
        'dob': 'Date of Birth',
        'date_of_birth': 'Date of Birth',
        'personal_email': 'Personal Email',
        'gender': 'Gender',
        'marital_status': 'Marital Status',
        'nationality': 'Nationality',
        'blood_group': 'Blood Group',
        'emergency_contact_name': 'Emergency Contact Name',
        'emergency_contact_phone': 'Emergency Contact Phone',
        'emergency_contact_relationship': 'Emergency Contact Relationship',
        'designation': 'Designation',
        'department_id': 'Department',
        'role_id': 'Role',
        'manager_id': 'Reporting Manager',
        'reporting_manager': 'Reporting Manager',
        'joining_date': 'Joining Date',
        'date_of_joining': 'Date of Joining',
        'employment_type': 'Employment Type',
        'employee_id': 'Employee ID',
        'employee_status': 'Employee Status',
        'status': 'Employee Status',
        'salary': 'Salary',
        'monthly_target': 'Monthly Target',
        'work_location': 'Work Location',
        'mac_address': 'MAC Address',
        'bank_account_number': 'Bank Account Number',
        'bank_name': 'Bank Name',
        'ifsc_code': 'IFSC Code',
        'pan_number': 'PAN Number',
        'aadhar_number': 'Aadhar Number',
        'onboarding_status': 'Onboarding Status',
        'crm_access': 'CRM Access',
        'has_crm_access': 'CRM Access',
        'login_enabled': 'Login Access',
        'is_active': 'Login Status',
        'otp_required': 'OTP Required',
        'username': 'Username',
        'profile_photo': 'Profile Photo',
    }
    SENSITIVE_FIELDS = {
        'password',
        'confirm_password',
        'old_password',
        'current_password',
        'new_password',
        'hashed_password',
    }
    META_FIELDS = {'created_at', 'updated_at', '_id'}

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
        activity_data["created_at"] = get_ist_now()
        activity_data["updated_at"] = get_ist_now()
        
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
            update_data["updated_at"] = get_ist_now()
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

    def _field_label(self, field: str) -> str:
        return self.FIELD_LABELS.get(field, field.replace('_', ' ').title())

    def _is_sensitive_field(self, field: str) -> bool:
        field_key = field.lower()
        return field_key in self.SENSITIVE_FIELDS or 'password' in field_key

    def _is_filled(self, value: Any) -> bool:
        if value is None:
            return False
        if isinstance(value, str):
            return value.strip() != ""
        if isinstance(value, (list, tuple, set, dict)):
            return len(value) > 0
        return True

    def _safe_value(self, value: Any) -> Any:
        if isinstance(value, ObjectId):
            return str(value)
        if isinstance(value, dict):
            return {
                key: self._safe_value(item)
                for key, item in value.items()
                if not self._is_sensitive_field(str(key))
            }
        if isinstance(value, (list, tuple, set)):
            return [self._safe_value(item) for item in value]
        if hasattr(value, "isoformat"):
            try:
                return value.isoformat()
            except Exception:
                return str(value)
        return value

    def _creation_field_details(self, employee_data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        field_details = {}
        for field, value in employee_data.items():
            if field in self.META_FIELDS or self._is_sensitive_field(field) or not self._is_filled(value):
                continue
            field_details[field] = {
                "label": self._field_label(field),
                "value": self._safe_value(value)
            }
        return field_details

    async def log_employee_creation(self, employee_id: str, created_by: str, employee_data: Dict[str, Any]):
        """Log employee creation activity with comprehensive details"""
        created_field_values = self._creation_field_details(employee_data)
        sensitive_fields_set = [
            self._field_label(field)
            for field, value in employee_data.items()
            if self._is_sensitive_field(field) and self._is_filled(value)
        ]
        activity_data = {
            "employee_id": employee_id,
            "activity_type": "employee_created",
            "action": "employee_created",
            "description": f"Employee record created",
            "details": {
                "employee_info": {
                    "name": f"{employee_data.get('first_name', '')} {employee_data.get('last_name', '')}".strip(),
                    "employee_id": self._safe_value(employee_data.get('employee_id')),
                    "email": self._safe_value(employee_data.get('email')),
                    "phone": self._safe_value(employee_data.get('phone')),
                    "department": self._safe_value(employee_data.get('department_id')),
                    "role": self._safe_value(employee_data.get('role_id')),
                    "designation": self._safe_value(employee_data.get('designation')),
                    "joining_date": self._safe_value(employee_data.get('joining_date') or employee_data.get('date_of_joining')),
                    "employment_type": self._safe_value(employee_data.get('employment_type')),
                    "status": self._safe_value(employee_data.get('employee_status') or employee_data.get('status', 'active'))
                },
                "created_fields": list(created_field_values.keys()),
                "created_field_values": created_field_values,
                "filled_field_count": len(created_field_values),
                "sensitive_fields_set": sensitive_fields_set
            },
            "created_by": created_by,
            "performed_by": created_by,
            "timestamp": get_ist_now().isoformat()
        }
        return await self.log_activity(activity_data)

    async def log_employee_update(self, employee_id: str, updated_by: str, changes: Dict[str, Any], original_data: Dict[str, Any] = None):
        """Log employee update activity with detailed field changes"""
        if original_data is None:
            original_data = {}
        
        # Track field changes with before/after values
        field_changes = {}
        security_updated = False
        raw_changes = {}
        
        for field, new_value in changes.items():
            if field in self.META_FIELDS:
                continue
            if self._is_sensitive_field(field):
                if self._is_filled(new_value):
                    security_updated = True
                continue
                
            old_value = original_data.get(field)
            
            # Handle value changes
            if old_value != new_value:
                field_changes[field] = {
                    'label': self._field_label(field),
                    'from': self._safe_value(old_value),
                    'to': self._safe_value(new_value)
                }
                raw_changes[field] = self._safe_value(new_value)

        if security_updated:
            field_changes["security_fields"] = {
                "label": "Security Fields",
                "from": "Previous values",
                "to": "Updated (hidden for security)"
            }
            raw_changes["security_fields"] = "Updated (hidden for security)"

        if not field_changes:
            return ""
        
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
                "raw_changes": raw_changes
            },
            "created_by": updated_by,
            "performed_by": updated_by,
            "timestamp": get_ist_now().isoformat()
        }
        return await self.log_activity(activity_data)

    async def log_status_change(self, employee_id: str, updated_by: str, old_status: str, new_status: str, remark: Optional[str] = None):
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
            "timestamp": get_ist_now().isoformat()
        }
        return await self.log_activity(activity_data)

    async def log_attachment_upload(self, employee_id: str, uploaded_by: str, attachment_data: Dict[str, Any]):
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
            "timestamp": get_ist_now().isoformat()
        }
        return await self.log_activity(activity_data)

    async def log_attachment_delete(self, employee_id: str, deleted_by: str, attachment_data: Dict[str, Any]):
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
            "timestamp": get_ist_now().isoformat()
        }
        return await self.log_activity(activity_data)

    async def log_remark_added(self, employee_id: str, added_by: str, remark_text: str):
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
            "timestamp": get_ist_now().isoformat()
        }
        return await self.log_activity(activity_data)

    async def log_password_change(self, employee_id: str, changed_by: str):
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
            "timestamp": get_ist_now().isoformat()
        }
        return await self.log_activity(activity_data)

    async def log_login_status_change(self, employee_id: str, changed_by: str, enabled: bool):
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
            "timestamp": get_ist_now().isoformat()
        }
        return await self.log_activity(activity_data)

    async def log_photo_upload(self, employee_id: str, uploaded_by: str, photo_path: str):
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
            "timestamp": get_ist_now().isoformat()
        }
        return await self.log_activity(activity_data)
