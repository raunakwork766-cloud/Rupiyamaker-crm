"""
Speed Dial bookmark database.

Shared company-wide speed dial tiles (folders + links) — visible to all
authenticated employees. `created_by` stores who added an item (audit only).

Document shape:
{
    _id: ObjectId,
    created_by: str,          # user who created (audit)
    type: "link" | "folder",
    parent_id: str | None,    # folder _id or None (root)
    title: str,
    url: str,                 # only for type == "link"
    image_url: str,           # optional tile image
    order: int,
    created_at: datetime,
    updated_at: datetime,
}
"""

from bson import ObjectId
from typing import List, Dict, Any, Optional
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.utils.timezone import get_ist_now
from app.config import Config

logger = logging.getLogger(__name__)


class SpeedDialDB:
    def __init__(self, db: AsyncIOMotorDatabase = None):
        if db is None:
            from motor.motor_asyncio import AsyncIOMotorClient
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.items = self.db["speed_dial_items"]

    async def init_indexes(self):
        try:
            await self.items.create_index("created_by")
            await self.items.create_index([("parent_id", 1), ("order", 1)])
            logger.info("✓ SpeedDial indexes created")
        except Exception as e:
            logger.warning(f"SpeedDial index creation warning: {e}")

    # ── Helpers ───────────────────────────────────────────────

    @staticmethod
    def _serialize(doc: Dict[str, Any]) -> Dict[str, Any]:
        if not doc:
            return doc
        doc["_id"] = str(doc["_id"])
        return doc

    # ── List ──────────────────────────────────────────────────

    async def list_items(
        self,
        parent_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {"parent_id": parent_id}
        cursor = self.items.find(query).sort([("order", 1)])
        docs = await cursor.to_list(length=None)
        return [self._serialize(d) for d in docs]

    async def list_all(self) -> List[Dict[str, Any]]:
        cursor = self.items.find({}).sort("order", 1)
        docs = await cursor.to_list(length=None)
        return [self._serialize(d) for d in docs]

    async def get_item(self, item_id: str) -> Optional[Dict[str, Any]]:
        doc = await self.items.find_one({"_id": ObjectId(item_id)})
        return self._serialize(doc) if doc else None

    # ── Create ────────────────────────────────────────────────

    async def create_item(self, created_by: str, data: Dict[str, Any]) -> str:
        parent_id = data.get("parent_id") or None
        last = await self.items.find_one(
            {"parent_id": parent_id},
            sort=[("order", -1)],
        )
        doc = {
            "created_by": created_by,
            "type": data.get("type", "link"),
            "parent_id": parent_id,
            "title": (data.get("title") or "").strip(),
            "url": (data.get("url") or "").strip(),
            "image_url": (data.get("image_url") or "").strip(),
            "order": (last.get("order", 0) + 1) if last else 1,
            "created_at": get_ist_now(),
            "updated_at": get_ist_now(),
        }
        result = await self.items.insert_one(doc)
        return str(result.inserted_id)

    # ── Update ────────────────────────────────────────────────

    async def update_item(self, item_id: str, data: Dict[str, Any]) -> bool:
        update: Dict[str, Any] = {}
        for key in ("title", "url", "image_url", "parent_id"):
            if key in data:
                value = data[key]
                if isinstance(value, str):
                    value = value.strip()
                update[key] = value
        if not update:
            return False
        update["updated_at"] = get_ist_now()
        result = await self.items.update_one(
            {"_id": ObjectId(item_id)}, {"$set": update}
        )
        return result.modified_count > 0

    # ── Delete ────────────────────────────────────────────────

    async def delete_item(self, item_id: str) -> bool:
        item = await self.items.find_one({"_id": ObjectId(item_id)})
        if not item:
            return False
        if item.get("type") == "folder":
            await self._delete_folder_children(str(item["_id"]))
        result = await self.items.delete_one({"_id": ObjectId(item_id)})
        return result.deleted_count > 0

    async def _delete_folder_children(self, folder_id: str):
        children = await self.items.find(
            {"parent_id": folder_id}
        ).to_list(length=None)
        for child in children:
            if child.get("type") == "folder":
                await self._delete_folder_children(str(child["_id"]))
        await self.items.delete_many({"parent_id": folder_id})

    # ── Reorder ───────────────────────────────────────────────

    async def reorder(self, parent_id: Optional[str], item_ids: List[str]) -> bool:
        for idx, item_id in enumerate(item_ids):
            await self.items.update_one(
                {"_id": ObjectId(item_id)},
                {"$set": {"order": idx + 1, "parent_id": parent_id, "updated_at": get_ist_now()}},
            )
        return True
