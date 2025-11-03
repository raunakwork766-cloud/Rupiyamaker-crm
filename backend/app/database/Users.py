from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import List, Dict, Optional, Any
from bson import ObjectId
from datetime import datetime
import logging
from app.utils.password_encryption import password_encryptor
from app.config import Config

# Set up logger
logger = logging.getLogger(__name__)

class UsersDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db["users"]
        # Note: Index creation will be done in init_indexes() which should be called after creation
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            await self.collection.create_index("username", unique=True)
            # Use phone as unique key instead of email to allow null emails
            await self.collection.create_index("phone", unique=True, sparse=True)  # sparse=True allows null values
            # ⚡ PERFORMANCE INDEXES for faster queries
            await self.collection.create_index([("role_id", 1)], background=True)
            await self.collection.create_index([("department_id", 1)], background=True)
            await self.collection.create_index([("is_active", 1)], background=True)
            await self.collection.create_index([("email", 1)], sparse=True, background=True)
            logger.info("✓ Users database indexes created successfully")
        except Exception as e:
            logger.warning(f"Users index creation warning (may already exist): {e}")
    
    async def _async_to_list(self, cursor):
        """Convert async Motor cursor to list"""
        return await cursor.to_list(None)
    
    def _hash_password(self, password: str) -> str:
        """Encrypt a password for storing (reversible for admin access)"""
        if not password:
            return ""
        return password_encryptor.encrypt_password(password)
        
    def _verify_password(self, plain_password: str, stored_password: str) -> bool:
        """Verify a password against stored password using Fernet encryption"""
        if not plain_password or not stored_password:
            return False
        
        # Use encryption/decryption for password verification
        try:
            decrypted_password = password_encryptor.decrypt_password(stored_password)
            return plain_password == decrypted_password
        except:
            # If decryption fails, compare directly (for any edge cases)
            return plain_password == stored_password
    
    def _get_readable_password(self, stored_password: str) -> str:
        """Get readable password for admin display using Fernet decryption"""
        if not stored_password:
            return ""
        
        # Decrypt password for admin access
        try:
            return password_encryptor.decrypt_password(stored_password)
        except:
            return "[Cannot Decrypt - Invalid Format]"
        
    async def _generate_employee_id(self) -> str:
        """Generate a unique sequential employee ID (numeric only)"""
        # Find all existing employee_ids
        employees = self.collection.find(
            {"employee_id": {"$exists": True, "$ne": None}},
            {"employee_id": 1}
        )
        
        max_id = 0
        async for emp in employees:
            emp_id = emp.get("employee_id", "")
            if emp_id:
                # Handle both formats: "RM123" and "123"
                if emp_id.startswith("RM"):
                    numeric_part = emp_id[2:]  # Remove "RM" prefix
                else:
                    numeric_part = emp_id
                
                try:
                    # Convert to int and track the maximum
                    id_num = int(numeric_part)
                    max_id = max(max_id, id_num)
                except ValueError:
                    # Skip invalid formats
                    continue
        
        # Generate next ID
        next_id = max_id + 1
        
        # Format as 3-digit string with leading zeros
        return f"{next_id:03d}"
        
    async def create_user(self, user_data: dict) -> str:
        """Create a new user with timestamps and hashed password"""
        # Hash password
        if 'password' in user_data:
            user_data['password'] = self._hash_password(user_data['password'])
            
        # Auto-generate employee ID if not provided and is_employee is True
        if user_data.get('is_employee', False) and not user_data.get('employee_id'):
            user_data['employee_id'] = await self._generate_employee_id()
            
        user_data["created_at"] = datetime.now()
        user_data["updated_at"] = user_data["created_at"]
        
        result = await self.collection.insert_one(user_data)
        return str(result.inserted_id)
        
    async def get_user(self, user_id: str) -> Optional[dict]:
        """Get a user by ID"""
        if not ObjectId.is_valid(user_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(user_id)})
        
    async def get_user_by_username(self, username: str) -> Optional[dict]:
        """Get a user by username"""
        return await self.collection.find_one({"username": username})
        
    async def get_user_by_email(self, email: str) -> Optional[dict]:
        """Get a user by email"""
        if not email:  # Handle None or empty email
            return None
        return await self.collection.find_one({"email": email})
        
    async def get_user_by_phone(self, phone: str) -> Optional[dict]:
        """Get a user by phone number"""
        if not phone:  # Handle None or empty phone
            return None
        return await self.collection.find_one({"phone": phone})
        
    async def list_users(self, filter_dict: dict = None, projection: dict = None) -> List[dict]:
        """⚡ OPTIMIZED: List users with optional filtering and field projection"""
        try:
            filter_dict = filter_dict or {}
            
            # ⚡ Use projection to reduce data transfer
            if projection is None:
                # Default projection excludes password for security and performance
                projection = {"password": 0}
            
            cursor = self.collection.find(filter_dict, projection)
            users = await cursor.to_list(None)
            return users
        except Exception as e:
            logger.error(f"Error listing users: {e}")
            return []
    
    async def get_users_batch(self, user_ids: List[str], projection: dict = None) -> Dict[str, dict]:
        """
        ⚡ OPTIMIZED: Batch fetch multiple users by IDs
        
        Args:
            user_ids: List of user ID strings
            projection: Optional field projection
            
        Returns:
            Dictionary mapping user_id to user document
        """
        try:
            # Convert string IDs to ObjectIds
            object_ids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]
            
            if not object_ids:
                return {}
            
            # Default projection excludes password
            if projection is None:
                projection = {"password": 0}
            
            # Batch fetch all users in one query
            cursor = self.collection.find({"_id": {"$in": object_ids}}, projection)
            users = await cursor.to_list(None)
            
            # Return as dictionary for O(1) lookups
            return {str(user["_id"]): user for user in users}
        except Exception as e:
            logger.error(f"Error in batch fetch users: {e}")
            return {}
            
    async def get_active_users(self) -> List[dict]:
        """
        Get all active users (not disabled)
        
        Returns:
            List[dict]: List of active users
        """
        try:
            logger.info("Fetching active users")
            users = []
            async for user in self.collection.find({"is_disabled": {"$ne": True}}):
                users.append(user)
            logger.info(f"Found {len(users)} active users")
            # Convert ObjectId to string
            for user in users:
                if '_id' in user:
                    user['_id'] = str(user['_id'])
            return users
        except Exception as e:
            logger.error(f"Error getting active users: {str(e)}", exc_info=True)
            return []
          
        
    async def update_user(self, user_id: str, update_fields: dict) -> bool:
        """Update a user with timestamp"""
        if not ObjectId.is_valid(user_id):
            return False
            
        # Hash password if it's being updated
        if 'password' in update_fields:
            update_fields['password'] = self._hash_password(update_fields['password'])
            
        update_fields["updated_at"] = datetime.now()
        result = await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_fields}
        )
        return result.modified_count == 1
        
    async def change_password(self, user_id: str, current_password: str, new_password: str) -> Dict[str, Any]:
        """Change user password after verifying current password"""
        if not ObjectId.is_valid(user_id):
            return {"success": False, "message": "Invalid user ID"}
            
        user = await self.get_user(user_id)
        if not user:
            return {"success": False, "message": "User not found"}
            
        # Verify current password
        if not self._verify_password(current_password, user['password']):
            return {"success": False, "message": "Current password is incorrect"}
            
        # Update password
        hashed_password = self._hash_password(new_password)
        result = await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"password": hashed_password, "updated_at": datetime.now()}}
        )
        
        if result.modified_count == 1:
            return {"success": True, "message": "Password changed successfully"}
        else:
            return {"success": False, "message": "Failed to update password"}
            
    async def reset_password(self, user_id: str, new_password: str) -> Dict[str, Any]:
        """Reset user password (admin function)"""
        if not ObjectId.is_valid(user_id):
            return {"success": False, "message": "Invalid user ID"}
            
        hashed_password = self._hash_password(new_password)
        result = await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"password": hashed_password, "updated_at": datetime.now()}}
        )
        
        if result.modified_count == 1:
            return {"success": True, "message": "Password reset successfully"}
        else:
            return {"success": False, "message": "Failed to reset password"}
            
    async def get_user_by_employee_id(self, employee_id: str) -> Optional[dict]:
        """Get a user by employee ID"""
        return await self.collection.find_one({"employee_id": employee_id})
        
    async def delete_user(self, user_id: str) -> bool:
        """Delete a user by ID"""
        if not ObjectId.is_valid(user_id):
            return False
        result = await self.collection.delete_one({"_id": ObjectId(user_id)})
        return result.deleted_count == 1
        
    async def authenticate_user(self, username_or_email: str, password: str) -> Optional[dict]:
        """Authenticate a user by username/email and password"""
        # Try to find user by username or email
        user = await self.get_user_by_username(username_or_email)
        if not user:
            user = await self.get_user_by_email(username_or_email)
            
        if not user:
            return None
            
        # Verify password
        if not self._verify_password(password, user['password']):
            return None
            
        # Don't return the password hash
        user.pop('password', None)
        return user
        
    async def get_users_by_role(self, role_id: str) -> List[dict]:
        """Get all users with a specific role"""
        return await self._async_to_list(self.collection.find({"role_id": role_id}))
        
    async def count_users(self, filter_dict: dict = None) -> int:
        """Count users matching the filter criteria"""
        filter_dict = filter_dict or {}
        return await self.collection.count_documents(filter_dict)
        
    async def get_employees(self, status: str = None, department_id: str = None) -> List[dict]:
        """Get all employees with optional filtering by status and department"""
        filter_dict = {"is_employee": True}
        
        if status:
            filter_dict["employee_status"] = status
            
        if department_id:
            filter_dict["department_id"] = department_id
            
        return await self._async_to_list(self.collection.find(filter_dict))
        
    async def create_employee(self, employee_data: dict) -> str:
        """Create a new employee with all necessary fields"""
        # Set employee flag
        employee_data["is_employee"] = True
        
        # Auto-generate employee ID if not provided (same logic as create_user)
        if not employee_data.get('employee_id'):
            employee_data['employee_id'] = await self._generate_employee_id()
        
        # Set default employee status if not provided
        if "employee_status" not in employee_data:
            employee_data["employee_status"] = "active"
            
        # Set default onboarding status if not provided
        if "onboarding_status" not in employee_data:
            employee_data["onboarding_status"] = "pending"
            
        # Hash password if provided and login is enabled
        if employee_data.get("login_enabled", False) and 'password' in employee_data:
            employee_data['password'] = self._hash_password(employee_data['password'])
        elif 'password' in employee_data:
            # Encrypt password even if login is not enabled for security
            employee_data['password'] = self._hash_password(employee_data['password'])
        
        # Convert date objects to datetime for MongoDB compatibility
        from datetime import date
        for key, value in employee_data.items():
            if isinstance(value, date):
                # Convert date to datetime at start of day
                employee_data[key] = datetime.combine(value, datetime.min.time())
        
        employee_data["created_at"] = datetime.now()
        employee_data["updated_at"] = employee_data["created_at"]
        
        result = await self.collection.insert_one(employee_data)
        employee_id = str(result.inserted_id)
        
        return employee_id
        
    async def ensure_required_fields(self):
        """Ensure that all users have the required fields: username, first_name, last_name"""
        missing_fields = self.collection.find({
            "$or": [
                {"username": {"$exists": False}}, 
                {"first_name": {"$exists": False}},
                {"last_name": {"$exists": False}},
                {"username": None},
                {"first_name": None},
                {"last_name": None},
                {"username": ""},
                {"first_name": ""},
                {"last_name": ""}
            ]
        })
        
        updates_count = 0
        for user in missing_fields:
            updates = {}
            
            # Create username from email if missing
            if "username" not in user or not user["username"]:
                if "email" in user and user["email"]:
                    updates["username"] = user["email"].split("@")[0]
                else:
                    updates["username"] = "user_" + str(user["_id"])
            
            # Create first_name and last_name from name if available
            if ("first_name" not in user or not user["first_name"]) and "name" in user and user["name"]:
                name_parts = user["name"].split(" ")
                updates["first_name"] = name_parts[0]
                if len(name_parts) > 1:
                    updates["last_name"] = " ".join(name_parts[1:])
            
            # Set default values if still missing
            if "first_name" not in user or not user["first_name"]:
                updates["first_name"] = "Unknown"
            
            if "last_name" not in user or not user["last_name"]:
                updates["last_name"] = "User"
            
            if updates:
                await self.collection.update_one({"_id": user["_id"]}, {"$set": updates})
                updates_count += 1
        
        return updates_count
        
    async def update_employee_status(self, employee_id: str, status: str, remark: str = None) -> bool:
        """Update the status of an employee (active/inactive) with minimal cascade logic"""
        if not ObjectId.is_valid(employee_id):
            return False
            
        update_fields = {
            "employee_status": status,
            "updated_at": datetime.now()
        }
        
        if remark:
            update_fields["status_remark"] = remark
            
        # Minimal cascade logic: Only update is_active for session monitoring
        # Don't automatically change login_enabled or otp_required - let admin control those
        if status == "inactive":
            update_fields["is_active"] = False  # This is crucial for session monitoring!
        elif status == "active":
            update_fields["is_active"] = True  # Reactivate the user
            
        result = await self.collection.update_one(
            {"_id": ObjectId(employee_id)},
            {"$set": update_fields}
        )
        return result.modified_count == 1
        
    async def update_onboarding_status(self, employee_id: str, status: str, remark: str = None) -> bool:
        """Update the onboarding status of an employee"""
        if not ObjectId.is_valid(employee_id):
            return False
            
        update_fields = {
            "onboarding_status": status,
            "updated_at": datetime.now()
        }
        
        if remark:
            update_fields["onboarding_remark"] = remark
            
        result = await self.collection.update_one(
            {"_id": ObjectId(employee_id)},
            {"$set": update_fields}
        )
        return result.modified_count == 1
        
    async def update_crm_access(self, employee_id: str, has_access: bool) -> bool:
        """Update whether an employee has CRM access"""
        if not ObjectId.is_valid(employee_id):
            return False
            
        update_fields = {
            "crm_access": has_access,
            "updated_at": datetime.now()
        }
            
        result = await self.collection.update_one(
            {"_id": ObjectId(employee_id)},
            {"$set": update_fields}
        )
        return result.modified_count == 1
        
    async def update_login_status(self, employee_id: str, enabled: bool) -> bool:
        """Enable or disable login for an employee without cascade logic"""
        if not ObjectId.is_valid(employee_id):
            return False
            
        update_fields = {
            "login_enabled": enabled,
            "updated_at": datetime.now()
        }
        
        # Removed cascade logic - admin can control login_enabled and otp_required independently
        # This allows more granular control without unwanted side effects
            
        result = await self.collection.update_one(
            {"_id": ObjectId(employee_id)},
            {"$set": update_fields}
        )
        return result.modified_count == 1
    
    async def update_otp_requirement(self, employee_id: str, required: bool) -> bool:
        """Enable or disable OTP requirement for an employee"""
        if not ObjectId.is_valid(employee_id):
            return False
            
        update_fields = {
            "otp_required": required,
            "updated_at": datetime.now()
        }
            
        result = await self.collection.update_one(
            {"_id": ObjectId(employee_id)},
            {"$set": update_fields}
        )
        return result.modified_count == 1
    
    async def update_user_active_status(self, user_id: str, is_active: bool) -> bool:
        """Update user's active status with minimal cascade logic"""
        if not ObjectId.is_valid(user_id):
            return False
            
        update_fields = {
            "is_active": is_active,
            "updated_at": datetime.now()
        }
        
        # Minimal cascade logic: Only for complete deactivation (security purposes)
        # Only disable login/OTP if explicitly deactivating AND employee_status is also inactive
        user = await self.get_user(user_id)
        if not is_active and user and user.get("employee_status") == "inactive":
            update_fields["login_enabled"] = False
            update_fields["otp_required"] = False
            
        result = await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_fields}
        )
        return result.modified_count == 1
            
        result = await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_fields}
        )
        return result.modified_count == 1
    
    async def update_employee(self, employee_id: str, update_fields: dict) -> bool:
        """Update an employee's information"""
        if not ObjectId.is_valid(employee_id):
            return False
            
        # Only hash password if it's being updated and not already hashed
        if 'password' in update_fields:
            password = str(update_fields['password'])
            # Check if it's already a bcrypt hash or Fernet encrypted
            if not (password.startswith('$2') or password.startswith('gAAAAAB')):
                update_fields['password'] = self._hash_password(password)
        
        # Convert date objects to datetime for MongoDB compatibility
        from datetime import date
        for key, value in update_fields.items():
            if isinstance(value, date):
                # Convert date to datetime at start of day
                update_fields[key] = datetime.combine(value, datetime.min.time())
        
        update_fields["updated_at"] = datetime.now()
        
        result = await self.collection.update_one(
            {"_id": ObjectId(employee_id)},
            {"$set": update_fields}
        )
        return result.modified_count == 1
    
    async def get_users_by_roles(self, role_ids: List[str], department_id: str = None) -> List[dict]:
        """
        Get all users with specific roles, optionally filtering by department
        
        Args:
            role_ids: List of role IDs to fetch users for
            department_id: Optional department ID to filter by
            
        Returns:
            List[dict]: Users with the specified roles
        """
        if not role_ids:
            return []
            
        # Convert string IDs to ObjectId
        object_role_ids = []
        str_role_ids = []
        
        for role_id in role_ids:
            if ObjectId.is_valid(role_id):
                object_role_ids.append(ObjectId(role_id))
                str_role_ids.append(str(role_id))
        
        if not object_role_ids and not str_role_ids:
            return []
            
        # Build filter to handle both string and ObjectId role_id values
        # Role ID can be stored either as a string or as an ObjectId
        filter_conditions = []
        
        if object_role_ids:
            filter_conditions.append({"role_id": {"$in": object_role_ids}})  # Match ObjectId role_id
            
        if str_role_ids:
            filter_conditions.append({"role_id": {"$in": str_role_ids}})      # Match string role_id
            
        filter_dict = {"$or": filter_conditions}
        
        # Add department filter if specified
        if department_id:
            if ObjectId.is_valid(department_id):
                dept_filter = {
                    "$or": [
                        {"department_id": department_id},           # String department ID
                        {"department_id": ObjectId(department_id)}  # ObjectId department ID
                    ]
                }
                filter_dict = {"$and": [filter_dict, dept_filter]}
        
        # Include all users for debugging purposes
        # Later, we can add the following to only include active users:
        # filter_dict = {"$and": [filter_dict, {"is_active": True}]}
        
        users = await self._async_to_list(self.collection.find(filter_dict))
            
        return users
    
    async def migrate_bcrypt_passwords_to_fernet(self) -> dict:
        """Migrate any bcrypt passwords to Fernet encryption for admin access"""
        result = {
            "migrated": 0,
            "already_encrypted": 0,
            "failed": 0,
            "details": []
        }
        
        # Find all users
        users = await self._async_to_list(self.collection.find({}))
        
        for user in users:
            user_id = user.get('_id')
            username = user.get('username', 'Unknown')
            password = user.get('password', '')
            
            if not password:
                continue
                
            # Check if password is bcrypt format
            if password.startswith('$2'):
                try:
                    # For bcrypt passwords, we need the plain text to convert
                    # Since we can't decrypt bcrypt, we'll mark these for manual update
                    result["failed"] += 1
                    result["details"].append({
                        "username": username,
                        "status": "bcrypt_requires_manual_update",
                        "message": "bcrypt password cannot be auto-migrated - user needs to reset password"
                    })
                    logger.warning(f"User {username} has bcrypt password that requires manual reset")
                except Exception as e:
                    result["failed"] += 1
                    result["details"].append({
                        "username": username,
                        "status": "error",
                        "message": str(e)
                    })
            else:
                # Check if already Fernet encrypted
                try:
                    password_encryptor.decrypt_password(password)
                    result["already_encrypted"] += 1
                    result["details"].append({
                        "username": username,
                        "status": "already_fernet_encrypted"
                    })
                except:
                    # Not Fernet encrypted, might be plain text
                    try:
                        # Encrypt as Fernet
                        encrypted_password = self._hash_password(password)
                        await self.collection.update_one(
                            {"_id": user_id},
                            {"$set": {"password": encrypted_password}}
                        )
                        result["migrated"] += 1
                        result["details"].append({
                            "username": username,
                            "status": "migrated_to_fernet"
                        })
                        logger.info(f"Migrated password for user {username} to Fernet encryption")
                    except Exception as e:
                        result["failed"] += 1
                        result["details"].append({
                            "username": username,
                            "status": "migration_failed",
                            "message": str(e)
                        })
                        
        return result