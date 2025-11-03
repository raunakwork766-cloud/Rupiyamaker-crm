from bson import ObjectId
from datetime import datetime, date
from typing import List, Dict, Any, Optional
import os
from app.config import Config
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import pymongo

class HolidaysDB:
    def __init__(self, db=None):
        if db is None:
            # Create connection if not provided
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.collection = self.db.holidays
        
    async def init_indexes(self):
        """Initialize database indexes asynchronously"""
        try:
            # Create indexes for better performance
            await self.collection.create_index("date")
            await self.collection.create_index("created_at")
            await self.collection.create_index([("date", 1), ("name", 1)], unique=True)
            print("✓ Holidays database indexes created successfully")
        except Exception as e:
            print(f"Holidays index creation warning (may already exist): {e}")

    async def _async_to_list(self, cursor):
        """Convert async Motor cursor to list"""
        return await cursor.to_list(None)

    async def add_holiday(self, holiday_data: Dict[str, Any]) -> str:
        """Add a new holiday"""
        try:
            # Add timestamps
            holiday_data["created_at"] = datetime.now()
            holiday_data["updated_at"] = datetime.now()
            
            # Insert the holiday
            result = await self.collection.insert_one(holiday_data)
            return str(result.inserted_id)
        except Exception as e:
            print(f"Error adding holiday: {e}")
            raise e

    async def get_holiday(self, holiday_id: str) -> Optional[Dict[str, Any]]:
        """Get a holiday by ID"""
        try:
            holiday = await self.collection.find_one({"_id": ObjectId(holiday_id)})
            if holiday:
                holiday["_id"] = str(holiday["_id"])
            return holiday
        except Exception as e:
            print(f"Error getting holiday: {e}")
            return None

    async def get_holidays_by_date_range(self, start_date: str, end_date: str) -> List[Dict[str, Any]]:
        """Get holidays within a date range"""
        try:
            query = {
                "date": {
                    "$gte": start_date,
                    "$lte": end_date
                }
            }
            
            cursor = self.collection.find(query).sort("date", 1)

            holidays = await cursor.to_list(length=None)

            # Convert ObjectIds to strings
            for holiday in holidays:
                holiday["_id"] = str(holiday["_id"])
            
            return holidays
        except Exception as e:
            print(f"Error getting holidays by date range: {e}")
            return []

    async def get_holidays_by_year(self, year: int) -> List[Dict[str, Any]]:
        """Get all holidays for a specific year"""
        try:
            start_date = f"{year}-01-01"
            end_date = f"{year}-12-31"
            return await self.get_holidays_by_date_range(start_date, end_date)
        except Exception as e:
            print(f"Error getting holidays by year: {e}")
            return []

    async def get_holidays_by_month(self, year: int, month: int) -> List[Dict[str, Any]]:
        """Get holidays for a specific month"""
        try:
            # Calculate the last day of the month
            import calendar
            last_day = calendar.monthrange(year, month)[1]
            
            start_date = f"{year}-{month:02d}-01"
            end_date = f"{year}-{month:02d}-{last_day:02d}"
            
            return await self.get_holidays_by_date_range(start_date, end_date)
        except Exception as e:
            print(f"Error getting holidays by month: {e}")
            return []

    async def get_all_holidays(self, limit: int = 100, skip: int = 0) -> List[Dict[str, Any]]:
        """Get all holidays with pagination"""
        try:
            holidays = await self._async_to_list(
                self.collection.find()
                .sort("date", 1)
                .skip(skip)
                .limit(limit)
            )
            
            # Convert ObjectIds to strings
            for holiday in holidays:
                holiday["_id"] = str(holiday["_id"])
            
            return holidays
        except Exception as e:
            print(f"Error getting all holidays: {e}")
            return []

    async def update_holiday(self, holiday_id: str, update_data: Dict[str, Any]) -> bool:
        """Update a holiday"""
        try:
            # Add updated timestamp
            update_data["updated_at"] = datetime.now()
            
            result = await self.collection.update_one(
                {"_id": ObjectId(holiday_id)},
                {"$set": update_data}
            )
            
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating holiday: {e}")
            return False

    async def delete_holiday(self, holiday_id: str) -> bool:
        """Delete a holiday"""
        try:
            result = await self.collection.delete_one({"_id": ObjectId(holiday_id)})
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error deleting holiday: {e}")
            return False

    async def is_holiday(self, date_str: str) -> bool:
        """Check if a specific date is a holiday"""
        try:
            holiday = await self.collection.find_one({"date": date_str})
            return holiday is not None
        except Exception as e:
            print(f"Error checking if date is holiday: {e}")
            return False

    async def get_holiday_by_date(self, date_str: str) -> Optional[Dict[str, Any]]:
        """Get holiday details for a specific date"""
        try:
            holiday = await self.collection.find_one({"date": date_str})
            if holiday:
                holiday["_id"] = str(holiday["_id"])
            return holiday
        except Exception as e:
            print(f"Error getting holiday by date: {e}")
            return None

    def bulk_add_holidays(self, holidays_data: List[Dict[str, Any]]) -> List[str]:
        """Add multiple holidays at once"""
        try:
            # Add timestamps to all holidays
            for holiday in holidays_data:
                holiday["created_at"] = datetime.now()
                holiday["updated_at"] = datetime.now()
            
            result = self.collection.insert_many(holidays_data)
            return [str(id) for id in result.inserted_ids]
        except Exception as e:
            print(f"Error bulk adding holidays: {e}")
            raise e

    async def delete_holidays_by_year(self, year: int) -> int:
        """Delete all holidays for a specific year"""
        try:
            start_date = f"{year}-01-01"
            end_date = f"{year}-12-31"
            
            result = await self.collection.delete_many({
                "date": {
                    "$gte": start_date,
                    "$lte": end_date
                }
            })
            
            return result.deleted_count
        except Exception as e:
            print(f"Error deleting holidays by year: {e}")
            return 0

    async def get_holiday_count(self) -> int:
        """Get total count of holidays"""
        try:
            return await self.collection.count_documents({})
        except Exception as e:
            print(f"Error getting holiday count: {e}")
            return 0

# Dependency function for FastAPI
async def get_holidays_db():
    from app.database import get_database_instances
    db_instances = get_database_instances()
    return db_instances.get("holidays") or HolidaysDB(db_instances["async_db"])
