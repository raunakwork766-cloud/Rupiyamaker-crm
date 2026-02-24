from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING
from bson import ObjectId
from datetime import datetime
from typing import List, Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)


class DialerDB:
    def __init__(self, db: AsyncIOMotorDatabase = None):
        if db is None:
            from motor.motor_asyncio import AsyncIOMotorClient
            from app.config import Config
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.toggles = self.db.dialer_warn_toggles
        self.uploads = self.db.dialer_upload_history

    async def init_indexes(self):
        try:
            await self.toggles.create_index([("ext", ASCENDING), ("at", DESCENDING)])
            await self.toggles.create_index([("toggled_by_id", ASCENDING)])
            await self.uploads.create_index([("uploaded_by_id", ASCENDING), ("uploaded_at", DESCENDING)])
            logger.info("Dialer indexes created successfully")
        except Exception as e:
            logger.error(f"Error creating dialer indexes: {e}")

    # ── Toggle History ────────────────────────────────────────────────────────

    async def add_toggle_event(self, ext: str, agent_name: str, action: str,
                                user_id: str, user_name: str) -> Dict:
        """Record a warning toggle on/off event."""
        doc = {
            "ext": ext,
            "agent_name": agent_name,
            "action": action,          # "on" or "off"
            "toggled_by_id": user_id,
            "toggled_by_name": user_name,
            "at": datetime.utcnow(),
        }
        result = await self.toggles.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        doc["at"] = doc["at"].isoformat()
        return doc

    async def get_toggle_history(self, ext: Optional[str] = None) -> List[Dict]:
        """Get all toggle events, optionally filtered by agent ext."""
        query = {"ext": ext} if ext else {}
        cursor = self.toggles.find(query).sort("at", DESCENDING)
        results = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            doc["at"] = doc["at"].isoformat() if isinstance(doc["at"], datetime) else doc["at"]
            results.append(doc)
        return results

    async def get_current_toggle_state(self) -> Dict[str, bool]:
        """
        Returns a dict of { ext: True/False } reflecting the current ON/OFF
        state of each agent's warning toggle (last event per ext).
        """
        pipeline = [
            {"$sort": {"at": -1}},
            {"$group": {"_id": "$ext", "action": {"$first": "$action"}}},
        ]
        state = {}
        async for doc in self.toggles.aggregate(pipeline):
            state[doc["_id"]] = doc["action"] == "on"
        return state

    # ── Upload History ────────────────────────────────────────────────────────

    async def save_upload(self, filename: str, record_count: int,
                          file_size: Optional[int], user_id: str,
                          user_name: str, agents: List[Dict]) -> Dict:
        """Save a new Excel upload entry (with full agents data)."""
        doc = {
            "filename": filename,
            "record_count": record_count,
            "file_size": file_size,
            "uploaded_by_id": user_id,
            "uploaded_by_name": user_name,
            "uploaded_at": datetime.utcnow(),
            "agents": agents,
        }
        result = await self.uploads.insert_one(doc)
        return {"id": str(result.inserted_id)}

    async def update_upload(self, upload_id: str, filename: str,
                            record_count: int, file_size: Optional[int],
                            user_id: str, user_name: str,
                            agents: List[Dict]) -> bool:
        """Replace agents data in an existing upload entry."""
        result = await self.uploads.update_one(
            {"_id": ObjectId(upload_id)},
            {"$set": {
                "filename": filename,
                "record_count": record_count,
                "file_size": file_size,
                "updated_by_id": user_id,
                "updated_by_name": user_name,
                "updated_at": datetime.utcnow(),
                "agents": agents,
            }}
        )
        return result.modified_count > 0

    async def get_upload_history(self, user_id: Optional[str] = None,
                                 include_agents: bool = False) -> List[Dict]:
        """List all uploads. Pass include_agents=True to include full data."""
        query = {}
        projection = None if include_agents else {"agents": 0}
        cursor = self.uploads.find(query, projection).sort("uploaded_at", DESCENDING)
        results = []
        async for doc in cursor:
            doc["id"] = str(doc.pop("_id"))
            doc["uploaded_at"] = doc["uploaded_at"].isoformat() if isinstance(doc.get("uploaded_at"), datetime) else doc.get("uploaded_at")
            if "updated_at" in doc and isinstance(doc["updated_at"], datetime):
                doc["updated_at"] = doc["updated_at"].isoformat()
            results.append(doc)
        return results

    async def get_upload_with_agents(self, upload_id: str) -> Optional[Dict]:
        """Get a single upload entry including full agents data."""
        doc = await self.uploads.find_one({"_id": ObjectId(upload_id)})
        if not doc:
            return None
        doc["id"] = str(doc.pop("_id"))
        doc["uploaded_at"] = doc["uploaded_at"].isoformat() if isinstance(doc.get("uploaded_at"), datetime) else doc.get("uploaded_at")
        return doc

    async def delete_upload(self, upload_id: str) -> bool:
        result = await self.uploads.delete_one({"_id": ObjectId(upload_id)})
        return result.deleted_count > 0
