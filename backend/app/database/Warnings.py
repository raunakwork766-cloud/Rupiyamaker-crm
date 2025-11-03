from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import Config
from pymongo import ASCENDING, DESCENDING
from bson import ObjectId
from datetime import datetime
from typing import List, Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)

class WarningDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db.warnings
    
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Index for employee warnings lookup
            await self.collection.create_index([("issued_to", ASCENDING), ("created_at", DESCENDING)])
            # Index for warning type analytics
            await self.collection.create_index([("warning_type", ASCENDING)])
            # Index for department filtering
            await self.collection.create_index([("department_id", ASCENDING)])
            # Index for issued by lookup
            await self.collection.create_index([("issued_by", ASCENDING)])
            # Compound index for filtering
            await self.collection.create_index([
                ("department_id", ASCENDING),
                ("warning_type", ASCENDING),
                ("created_at", DESCENDING)
            ])
            logger.info("Warning indexes created successfully")
        except Exception as e:
            logger.error(f"Error creating warning indexes: {e}")
    
    async def create_warning(self, warning_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new warning"""
        try:
            # Add timestamps
            current_time = datetime.now()
            warning_data['created_at'] = current_time
            warning_data['updated_at'] = current_time
            warning_data['issued_date'] = current_time  # Set issued_date to current time
            
            # Convert string IDs to ObjectIds where needed
            if 'issued_to' in warning_data:
                warning_data['issued_to'] = ObjectId(warning_data['issued_to'])
            if 'issued_by' in warning_data:
                warning_data['issued_by'] = ObjectId(warning_data['issued_by'])
            if 'department_id' in warning_data:
                warning_data['department_id'] = ObjectId(warning_data['department_id'])
            
            result = await self.collection.insert_one(warning_data)
            
            # Return the created warning with string IDs
            created_warning = await self.collection.find_one({"_id": result.inserted_id})
            return self._convert_objectids_to_strings(created_warning)
            
        except Exception as e:
            logger.error(f"Error creating warning: {e}")
            raise
    
    async def get_warning_by_id(self, warning_id: str) -> Optional[Dict[str, Any]]:
        """Get warning by ID"""
        try:
            warning = await self.collection.find_one({"_id": ObjectId(warning_id)})
            if warning:
                return self._convert_objectids_to_strings(warning)
            return None
        except Exception as e:
            logger.error(f"Error getting warning by ID: {e}")
            return None
    
    async def get_employee_warnings(self, employee_id: str, limit: int = 100, skip: int = 0) -> List[Dict[str, Any]]:
        """Get warnings for a specific employee"""
        try:
            cursor = self.collection.find(
                {"issued_to": ObjectId(employee_id)}
            ).sort("created_at", DESCENDING).limit(limit).skip(skip)
            warnings = await cursor.to_list(None)
            
            return [self._convert_objectids_to_strings(warning) for warning in warnings]
        except Exception as e:
            logger.error(f"Error getting employee warnings: {e}")
            return []
    
    async def get_all_warnings(self, filters: Dict[str, Any] = None, limit: int = 100, skip: int = 0) -> List[Dict[str, Any]]:
        """Get all warnings with optional filters"""
        try:
            query = {}
            
            if filters:
                # Department filter
                if 'department_id' in filters and filters['department_id']:
                    query['department_id'] = ObjectId(filters['department_id'])
                
                # Employee filter (supports both employee_id and issued_to keys)
                if 'employee_id' in filters and filters['employee_id']:
                    query['issued_to'] = ObjectId(filters['employee_id'])
                elif 'issued_to' in filters and filters['issued_to']:
                    # Handle direct issued_to filter (for permission-based filtering)
                    issued_to_filter = filters['issued_to']
                    if isinstance(issued_to_filter, dict):
                        # Handle complex filters like {"$in": [ObjectId1, ObjectId2]}
                        query['issued_to'] = issued_to_filter
                    else:
                        # Handle simple ObjectId filter
                        if isinstance(issued_to_filter, str):
                            query['issued_to'] = ObjectId(issued_to_filter)
                        else:
                            query['issued_to'] = issued_to_filter
                
                # Warning type filter
                if 'warning_type' in filters and filters['warning_type']:
                    query['warning_type'] = filters['warning_type']
                
                # Date range filter
                if 'start_date' in filters and filters['start_date']:
                    if 'created_at' not in query:
                        query['created_at'] = {}
                    query['created_at']['$gte'] = datetime.strptime(filters['start_date'], '%Y-%m-%d')
                
                if 'end_date' in filters and filters['end_date']:
                    if 'created_at' not in query:
                        query['created_at'] = {}
                    query['created_at']['$lte'] = datetime.strptime(filters['end_date'], '%Y-%m-%d')
                
                # Issued by filter
                if 'issued_by' in filters and filters['issued_by']:
                    query['issued_by'] = ObjectId(filters['issued_by'])
            
            cursor = self.collection.find(query).sort("created_at", DESCENDING).limit(limit).skip(skip)
            warnings = await cursor.to_list(None)
            return [self._convert_objectids_to_strings(warning) for warning in warnings]
            
        except Exception as e:
            logger.error(f"Error getting all warnings: {e}")
            return []
    
    async def update_warning(self, warning_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update warning"""
        try:
            update_data['updated_at'] = datetime.now()
            
            # Convert string IDs to ObjectIds where needed
            if 'issued_to' in update_data:
                update_data['issued_to'] = ObjectId(update_data['issued_to'])
            if 'department_id' in update_data:
                update_data['department_id'] = ObjectId(update_data['department_id'])
            
            result = await self.collection.update_one(
                {"_id": ObjectId(warning_id)},
                {"$set": update_data}
            )
            
            if result.modified_count > 0:
                updated_warning = await self.collection.find_one({"_id": ObjectId(warning_id)})
                return self._convert_objectids_to_strings(updated_warning)
            return None
            
        except Exception as e:
            logger.error(f"Error updating warning: {e}")
            return None
    
    async def delete_warning(self, warning_id: str) -> bool:
        """Delete warning"""
        try:
            result = await self.collection.delete_one({"_id": ObjectId(warning_id)})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting warning: {e}")
            return False
    
    async def check_duplicate_warning(self, employee_id: str, warning_type: str, warning_message: str = None) -> Dict[str, Any]:
        """Check if employee already has a warning with same type (and optionally same message)"""
        try:
            query = {
                "issued_to": ObjectId(employee_id),
                "warning_type": warning_type
            }
            
            # Add message filter if provided
            if warning_message:
                query["warning_message"] = warning_message
            
            # Check for recent warning (today)
            from datetime import datetime, timedelta
            today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            query["created_at"] = {"$gte": today_start}
            
            existing_warning = await self.collection.find_one(query)
            
            if existing_warning:
                return {
                    "has_duplicate": True,
                    "existing_warning": self._convert_objectids_to_strings(existing_warning)
                }
            
            return {
                "has_duplicate": False,
                "existing_warning": None
            }
            
        except Exception as e:
            logger.error(f"Error checking duplicate warning: {e}")
            return {
                "has_duplicate": False,
                "existing_warning": None
            }
    
    async def get_warning_statistics(self, filters: Dict[str, Any] = None) -> Dict[str, Any]:
        """Get warning statistics"""
        try:
            match_stage = {}
            
            if filters:
                if 'department_id' in filters and filters['department_id']:
                    match_stage['department_id'] = ObjectId(filters['department_id'])
                
                if 'start_date' in filters and filters['start_date']:
                    if 'created_at' not in match_stage:
                        match_stage['created_at'] = {}
                    match_stage['created_at']['$gte'] = datetime.strptime(filters['start_date'], '%Y-%m-%d')
                
                if 'end_date' in filters and filters['end_date']:
                    if 'created_at' not in match_stage:
                        match_stage['created_at'] = {}
                    match_stage['created_at']['$lte'] = datetime.strptime(filters['end_date'], '%Y-%m-%d')
            
            pipeline = []
            
            if match_stage:
                pipeline.append({"$match": match_stage})
            
            # Total warnings
            total_warnings = await self.collection.count_documents(match_stage if match_stage else {})
            
            # Most frequent warning type
            warning_type_pipeline = pipeline + [
                {"$group": {"_id": "$warning_type", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 1}
            ]
            
            most_frequent_type = await self._async_to_list(self.collection.aggregate(warning_type_pipeline))
            most_frequent_warning = most_frequent_type[0] if most_frequent_type else {"_id": "None", "count": 0}
            
            # Total penalties
            penalty_pipeline = pipeline + [
                {"$group": {"_id": None, "total_penalty": {"$sum": "$penalty_amount"}}}
            ]
            
            penalty_result = await self._async_to_list(self.collection.aggregate(penalty_pipeline))
            total_penalties = penalty_result[0]["total_penalty"] if penalty_result else 0
            
            # Employee with most warnings
            employee_warning_pipeline = pipeline + [
                {"$group": {"_id": "$issued_to", "warning_count": {"$sum": 1}}},
                {"$sort": {"warning_count": -1}},
                {"$limit": 1}
            ]
            
            employee_result = await self._async_to_list(self.collection.aggregate(employee_warning_pipeline))
            employee_with_most_warnings = employee_result[0] if employee_result else {"_id": None, "warning_count": 0}
            
            return {
                "total_warnings": total_warnings,
                "most_frequent_warning_type": most_frequent_warning["_id"],
                "most_frequent_warning_count": most_frequent_warning["count"],
                "total_penalties": total_penalties,
                "employee_with_most_warnings_id": str(employee_with_most_warnings["_id"]) if employee_with_most_warnings["_id"] else None,
                "employee_with_most_warnings_count": employee_with_most_warnings["warning_count"]
            }
            
        except Exception as e:
            logger.error(f"Error getting warning statistics: {e}")
            return {
                "total_warnings": 0,
                "most_frequent_warning_type": "None",
                "most_frequent_warning_count": 0,
                "total_penalties": 0,
                "employee_with_most_warnings_id": None,
                "employee_with_most_warnings_count": 0
            }
    
    async def get_employee_warning_ranking(self, limit: int = 50, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get employee warning ranking"""
        try:
            match_stage = {}
            
            if filters:
                if 'department_id' in filters and filters['department_id']:
                    match_stage['department_id'] = ObjectId(filters['department_id'])
                
                if 'start_date' in filters and filters['start_date']:
                    if 'created_at' not in match_stage:
                        match_stage['created_at'] = {}
                    match_stage['created_at']['$gte'] = datetime.strptime(filters['start_date'], '%Y-%m-%d')
                
                if 'end_date' in filters and filters['end_date']:
                    if 'created_at' not in match_stage:
                        match_stage['created_at'] = {}
                    match_stage['created_at']['$lte'] = datetime.strptime(filters['end_date'], '%Y-%m-%d')
            
            pipeline = []
            
            if match_stage:
                pipeline.append({"$match": match_stage})
            
            pipeline.extend([
                {"$group": {
                    "_id": "$issued_to",
                    "total_warnings": {"$sum": 1},
                    "total_penalty": {"$sum": "$penalty_amount"}
                }},
                {"$sort": {"total_warnings": -1}},
                {"$limit": limit}
            ])
            
            ranking = await self._async_to_list(self.collection.aggregate(pipeline))
            
            # Convert ObjectIds to strings
            for rank in ranking:
                rank["employee_id"] = str(rank["_id"])
                del rank["_id"]
            
            return ranking
            
        except Exception as e:
            logger.error(f"Error getting employee warning ranking: {e}")
            return []
    
    async def get_warning_count(self, filters: Dict[str, Any] = None) -> int:
        """Get total count of warnings with filters"""
        try:
            query = {}
            
            if filters:
                if 'department_id' in filters and filters['department_id']:
                    query['department_id'] = ObjectId(filters['department_id'])
                
                if 'employee_id' in filters and filters['employee_id']:
                    query['issued_to'] = ObjectId(filters['employee_id'])
                
                if 'warning_type' in filters and filters['warning_type']:
                    query['warning_type'] = filters['warning_type']
                
                if 'start_date' in filters and filters['start_date']:
                    if 'created_at' not in query:
                        query['created_at'] = {}
                    query['created_at']['$gte'] = datetime.strptime(filters['start_date'], '%Y-%m-%d')
                
                if 'end_date' in filters and filters['end_date']:
                    if 'created_at' not in query:
                        query['created_at'] = {}
                    query['created_at']['$lte'] = datetime.strptime(filters['end_date'], '%Y-%m-%d')
                
                if 'issued_by' in filters and filters['issued_by']:
                    query['issued_by'] = ObjectId(filters['issued_by'])
            
            return await self.collection.count_documents(query)
            
        except Exception as e:
            logger.error(f"Error getting warning count: {e}")
            return 0
    
    async def export_warnings_csv(self, filter_dict: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Export warnings data for CSV generation"""
        try:
            # Build query
            query = {}
            
            if filter_dict:
                # Department filter
                if filter_dict.get('department_id'):
                    query['department_id'] = ObjectId(filter_dict['department_id'])
                
                # Employee filter
                if filter_dict.get('employee_id'):
                    query['issued_to'] = ObjectId(filter_dict['employee_id'])
                
                # Warning type filter
                if filter_dict.get('warning_type'):
                    query['warning_type'] = filter_dict['warning_type']
                
                # Date range filter
                if filter_dict.get('start_date') or filter_dict.get('end_date'):
                    date_query = {}
                    if filter_dict.get('start_date'):
                        date_query['$gte'] = filter_dict['start_date']
                    if filter_dict.get('end_date'):
                        date_query['$lte'] = filter_dict['end_date']
                    if date_query:
                        query['created_at'] = date_query
            
            # Get all warnings matching the filter
            cursor = self.collection.find(query).sort("created_at", DESCENDING)
            warnings = await cursor.to_list(None)
            
            # Convert ObjectIds to strings for export
            export_data = []
            for warning in warnings:
                # Convert ObjectIds
                warning_dict = self._convert_objectids_to_strings(warning.copy())
                
                # Format the data for CSV export with better column order
                export_row = {
                    'Warning ID': warning_dict.get('id', ''),
                    'Employee ID': warning_dict.get('issued_to', ''),
                    'Warning Type': warning_dict.get('warning_type', ''),
                    'Warning Message': warning_dict.get('warning_message', ''),
                    'Penalty Amount': warning_dict.get('penalty_amount', 0),
                    'Department ID': warning_dict.get('department_id', ''),
                    'Issued By ID': warning_dict.get('issued_by', ''),
                    'Issued Date': warning_dict.get('issued_date', ''),
                    'Created At': warning_dict.get('created_at', ''),
                    'Updated At': warning_dict.get('updated_at', '')
                }
                export_data.append(export_row)
            
            logger.info(f"Exported {len(export_data)} warnings for CSV")
            return export_data
            
        except Exception as e:
            logger.error(f"Error exporting warnings to CSV: {e}")
            return []

    def _convert_objectids_to_strings(self, document: Dict[str, Any]) -> Dict[str, Any]:
        """Convert ObjectIds in document to strings"""
        if document is None:
            return None
        
        # Convert _id
        if '_id' in document:
            document['id'] = str(document['_id'])
            del document['_id']
        
        # Convert other ObjectId fields
        for field in ['issued_to', 'issued_by', 'department_id']:
            if field in document and isinstance(document[field], ObjectId):
                document[field] = str(document[field])
        
        return document
    
    async def _async_to_list(self, cursor):
        """Convert async Motor cursor to list"""
        return await cursor.to_list(None)
    
    async def get_warnings_by_employee_and_type(self, employee_id: str, warning_type: str) -> List[Dict[str, Any]]:
        """Get all warnings for a specific employee with a specific warning type"""
        try:
            query = {
                "issued_to": ObjectId(employee_id),
                "warning_type": warning_type
            }
            
            cursor = self.collection.find(query).sort("created_at", -1)  # Most recent first
            warnings = await cursor.to_list(None)
            
            # Convert ObjectIds to strings
            for warning in warnings:
                warning = self._convert_objectids_to_strings(warning)
                
            return warnings
            
        except Exception as e:
            logger.error(f"Error getting warnings by employee and type: {e}")
            return []

# Legacy support - warning_db is now initialized in __init__.py
# Use get_database_instances() from app.database to get warning_db instance
warning_db = None  # Will be set by init_database() in __init__.py
