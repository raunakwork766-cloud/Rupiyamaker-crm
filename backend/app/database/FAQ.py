from bson import ObjectId
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.utils.timezone import get_ist_now
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.config import Config

logger = logging.getLogger(__name__)


class FAQDB:
    def __init__(self, db: AsyncIOMotorDatabase = None):
        if db is None:
            from motor.motor_asyncio import AsyncIOMotorClient
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.categories = self.db["faq_categories"]
        self.items = self.db["faq_items"]

    async def init_indexes(self):
        try:
            await self.categories.create_index("order")
            await self.categories.create_index("is_active")
            await self.items.create_index("category_id")
            await self.items.create_index("is_active")
            await self.items.create_index("order")
            await self.items.create_index([("question", "text"), ("answer", "text")])
            logger.info("✓ FAQ indexes created")
        except Exception as e:
            logger.warning(f"FAQ index creation warning: {e}")

    # ── CATEGORIES ────────────────────────────────────────────

    async def create_category(self, data: Dict[str, Any]) -> str:
        last = await self.categories.find_one({}, sort=[("order", -1)])
        data["order"] = (last.get("order", 0) + 1) if last else 1
        data["is_active"] = data.get("is_active", True)
        data["created_at"] = get_ist_now()
        data["updated_at"] = get_ist_now()
        result = await self.categories.insert_one(data)
        return str(result.inserted_id)

    async def get_categories(self, active_only: bool = True) -> List[Dict[str, Any]]:
        query = {"is_active": True} if active_only else {}
        cursor = self.categories.find(query).sort("order", 1)
        docs = await cursor.to_list(length=None)
        for d in docs:
            d["_id"] = str(d["_id"])
        return docs

    async def get_category(self, category_id: str) -> Optional[Dict[str, Any]]:
        doc = await self.categories.find_one({"_id": ObjectId(category_id)})
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    async def update_category(self, category_id: str, data: Dict[str, Any]) -> bool:
        data["updated_at"] = get_ist_now()
        result = await self.categories.update_one(
            {"_id": ObjectId(category_id)}, {"$set": data}
        )
        return result.modified_count > 0

    async def delete_category(self, category_id: str) -> bool:
        # Delete the category
        result = await self.categories.delete_one({"_id": ObjectId(category_id)})
        # Optionally delete all items in this category
        await self.items.delete_many({"category_id": category_id})
        return result.deleted_count > 0

    # ── FAQ ITEMS ─────────────────────────────────────────────

    async def create_item(self, data: Dict[str, Any]) -> str:
        last = await self.items.find_one(
            {"category_id": data.get("category_id")}, sort=[("order", -1)]
        )
        data["order"] = (last.get("order", 0) + 1) if last else 1
        data["is_active"] = data.get("is_active", True)
        data["tags"] = data.get("tags", [])
        data["created_at"] = get_ist_now()
        data["updated_at"] = get_ist_now()
        result = await self.items.insert_one(data)
        return str(result.inserted_id)

    async def get_items(
        self,
        category_id: Optional[str] = None,
        active_only: bool = True,
        search: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {}
        if active_only:
            query["is_active"] = True
        if category_id:
            query["category_id"] = category_id
        if search:
            query["$text"] = {"$search": search}
        cursor = self.items.find(query).sort("order", 1)
        docs = await cursor.to_list(length=None)
        for d in docs:
            d["_id"] = str(d["_id"])
        return docs

    async def get_item(self, item_id: str) -> Optional[Dict[str, Any]]:
        doc = await self.items.find_one({"_id": ObjectId(item_id)})
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    async def update_item(self, item_id: str, data: Dict[str, Any]) -> bool:
        data["updated_at"] = get_ist_now()
        result = await self.items.update_one(
            {"_id": ObjectId(item_id)}, {"$set": data}
        )
        return result.modified_count > 0

    async def delete_item(self, item_id: str) -> bool:
        result = await self.items.delete_one({"_id": ObjectId(item_id)})
        return result.deleted_count > 0

    async def reorder_items(self, item_ids: List[str]) -> bool:
        """Reorder items by providing an ordered list of IDs."""
        for idx, item_id in enumerate(item_ids):
            await self.items.update_one(
                {"_id": ObjectId(item_id)}, {"$set": {"order": idx + 1}}
            )
        return True
