from pymongo import ASCENDING, DESCENDING
from bson import ObjectId
from datetime import datetime
from app.utils.timezone import get_ist_now
from typing import List, Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)


class DialerDB:
    def __init__(self, db: Any = None):
        if db is None:
            from motor.motor_asyncio import AsyncIOMotorClient
            from app.config import Config
            client = AsyncIOMotorClient(Config.MONGO_URI)
            self.db = client[Config.COMPANY_NAME]
        else:
            self.db = db
        self.toggles = self.db.dialer_warn_toggles
        self.uploads = self.db.dialer_upload_history
        self.remarks = self.db.dialer_remarks
        self.agent_mappings = self.db.dialer_agent_mappings
        self.agent_profiles = self.db.dialer_agent_profiles
        self.login_entries = self.db.dialer_login_entries
        self.lead_entries = self.db.dialer_lead_entries

    async def init_indexes(self):
        try:
            await self.toggles.create_index([("ext", ASCENDING), ("at", DESCENDING)])
            await self.toggles.create_index([("toggled_by_id", ASCENDING)])
            await self.uploads.create_index([("uploaded_by_id", ASCENDING), ("uploaded_at", DESCENDING)])
            await self.remarks.create_index([("ext", ASCENDING), ("date", ASCENDING)])
            await self.agent_mappings.create_index([("ext", ASCENDING)], unique=True)
            await self.agent_profiles.create_index([("profile_name", ASCENDING)], unique=True)
            await self.login_entries.create_index([("ext", ASCENDING), ("date", ASCENDING)])
            await self.lead_entries.create_index([("ext", ASCENDING), ("date", ASCENDING)])
            logger.info("Dialer indexes created successfully")
        except Exception as e:
            logger.error(f"Error creating dialer indexes: {e}")

    # ── Toggle History ────────────────────────────────────────────────────────

    async def add_toggle_event(self, ext: str, agent_name: str, action: str,
                                user_id: str, user_name: str, employee_id: str = "", remarks: str = "") -> Dict:
        """Record a warning toggle on/off event."""
        doc = {
            "ext": ext,
            "agent_name": agent_name,
            "action": action,
            "toggled_by_id": user_id,
            "toggled_by_name": user_name,
            "toggled_by_employee_id": employee_id,
            "remarks": remarks,
            "at": get_ist_now(),
        }
        result = await self.toggles.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        doc["at"] = doc["at"].isoformat()
        return doc

    async def delete_toggle_events(self, ext: str):
        """Delete all toggle events for a given ext."""
        await self.toggles.delete_many({"ext": ext})

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
            "uploaded_at": get_ist_now(),
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
                "updated_at": get_ist_now(),
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

    # ── Remarks / Justification ───────────────────────────────────────────────

    async def add_remark(self, ext: str, agent_name: str, date: str,
                         remark_type: str, remark_text: str, time_minutes: int,
                         user_id: str, user_name: str, employee_id: str = "") -> Dict:
        doc = {
            "ext": ext, "agent_name": agent_name, "date": date,
            "remark_type": remark_type, "remark_text": remark_text,
            "time_minutes": time_minutes,
            "added_by_id": user_id, "added_by_name": user_name,
            "added_by_employee_id": employee_id,
            "created_at": get_ist_now(),
        }
        result = await self.remarks.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        doc["created_at"] = doc["created_at"].isoformat()
        return doc

    async def get_remarks(self, ext: Optional[str] = None, date: Optional[str] = None) -> List[Dict]:
        query = {}
        if ext: query["ext"] = ext
        if date: query["date"] = date
        cursor = self.remarks.find(query).sort("created_at", DESCENDING)
        results = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if isinstance(doc.get("created_at"), datetime):
                doc["created_at"] = doc["created_at"].isoformat()
            results.append(doc)
        return results

    async def delete_remark(self, remark_id: str) -> bool:
        result = await self.remarks.delete_one({"_id": ObjectId(remark_id)})
        return result.deleted_count > 0

    async def justify_remark(self, remark_id: str, justify_remark: str,
                             user_id: str, user_name: str) -> bool:
        result = await self.remarks.update_one(
            {"_id": ObjectId(remark_id)},
            {"$set": {
                "justified": True, "justify_remark": justify_remark,
                "justified_by_id": user_id, "justified_by_name": user_name,
                "justified_at": get_ist_now(),
            }}
        )
        return result.modified_count > 0

    async def unjustify_remark(self, remark_id: str) -> bool:
        result = await self.remarks.update_one(
            {"_id": ObjectId(remark_id)},
            {"$unset": {"justified": "", "justify_remark": "",
                        "justified_by_id": "", "justified_by_name": "",
                        "justified_at": ""}}
        )
        return result.modified_count > 0

    # ── Agent Mappings ────────────────────────────────────────────────────────

    async def upsert_agent_mapping(self, ext: str, dialer_name: str = "",
                                    mapped_name: str = "", designation: str = "",
                                    team: str = "", user_id: str = "",
                                    user_name: str = "") -> Dict:
        doc = {
            "ext": ext, "dialer_name": dialer_name,
            "mapped_name": mapped_name, "designation": designation,
            "team": team, "updated_by_id": user_id,
            "updated_by_name": user_name, "updated_at": get_ist_now(),
        }
        await self.agent_mappings.update_one(
            {"ext": ext}, {"$set": doc, "$setOnInsert": {"created_at": get_ist_now()}},
            upsert=True
        )
        saved = await self.agent_mappings.find_one({"ext": ext})
        if saved:
            saved["_id"] = str(saved["_id"])
            for k in ("created_at", "updated_at"):
                if isinstance(saved.get(k), datetime):
                    saved[k] = saved[k].isoformat()
        return saved or doc

    async def bulk_upsert_agent_mappings(self, mappings: List[Dict],
                                          user_id: str = "", user_name: str = "") -> int:
        count = 0
        for m in mappings:
            ext = m.get("ext")
            if not ext: continue
            await self.agent_mappings.update_one(
                {"ext": ext},
                {"$set": {
                    "ext": ext,
                    "dialer_name": m.get("dialer_name", ""),
                    "mapped_name": m.get("mapped_name", ""),
                    "designation": m.get("designation", ""),
                    "team": m.get("team", ""),
                    "updated_by_id": user_id, "updated_by_name": user_name,
                    "updated_at": get_ist_now(),
                }, "$setOnInsert": {"created_at": get_ist_now()}},
                upsert=True
            )
            count += 1
        return count

    async def get_all_agent_mappings(self) -> List[Dict]:
        cursor = self.agent_mappings.find()
        results = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            for k in ("created_at", "updated_at"):
                if isinstance(doc.get(k), datetime):
                    doc[k] = doc[k].isoformat()
            results.append(doc)
        return results

    async def get_agent_mapping(self, ext: str) -> Optional[Dict]:
        doc = await self.agent_mappings.find_one({"ext": ext})
        if doc:
            doc["_id"] = str(doc["_id"])
            for k in ("created_at", "updated_at"):
                if isinstance(doc.get(k), datetime):
                    doc[k] = doc[k].isoformat()
        return doc

    async def delete_agent_mapping(self, ext: str) -> bool:
        result = await self.agent_mappings.delete_one({"ext": ext})
        return result.deleted_count > 0

    # ── Agent Profiles (name/designation/team, independent of extensions) ─────

    async def bulk_save_agent_profiles(self, profiles: List[Dict],
                                        user_id: str = "", user_name: str = "") -> int:
        """Save/update agent profiles (name, designation, team) independently."""
        if not profiles:
            return 0
        from pymongo import UpdateOne
        ops = []
        for p in profiles:
            name = p.get("mapped_name", "").strip()
            if not name:
                continue
            ops.append(UpdateOne(
                {"profile_name": name},
                {"$set": {
                    "profile_name": name,
                    "designation": p.get("designation", ""),
                    "team": p.get("team", ""),
                    "updated_by_id": user_id,
                    "updated_by_name": user_name,
                    "updated_at": get_ist_now(),
                }, "$setOnInsert": {"created_at": get_ist_now()}},
                upsert=True
            ))
        if not ops:
            return 0
        result = await self.agent_profiles.bulk_write(ops)
        # Also delete profiles no longer in the list
        names = [p.get("mapped_name", "").strip() for p in profiles if p.get("mapped_name", "").strip()]
        await self.agent_profiles.delete_many({"profile_name": {"$nin": names}})
        return result.upserted_count + result.modified_count

    async def get_all_agent_profiles(self) -> List[Dict]:
        """Get all saved agent profiles."""
        cursor = self.agent_profiles.find({}).sort("profile_name", ASCENDING)
        results = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            for k in ("created_at", "updated_at"):
                if isinstance(doc.get(k), datetime):
                    doc[k] = doc[k].isoformat()
            results.append(doc)
        return results

    # ── Login Entries ─────────────────────────────────────────────────────────

    async def add_login_entry(self, ext: str, agent_name: str, date: str,
                              entry_type: str, entry_text: str,
                              user_id: str, user_name: str, employee_id: str = "") -> Dict:
        doc = {
            "ext": ext, "agent_name": agent_name, "date": date,
            "entry_type": entry_type, "entry_text": entry_text,
            "added_by_id": user_id, "added_by_name": user_name,
            "added_by_employee_id": employee_id,
            "created_at": get_ist_now(),
        }
        result = await self.login_entries.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        doc["created_at"] = doc["created_at"].isoformat()
        return doc

    async def get_login_entries(self, ext: Optional[str] = None, date: Optional[str] = None) -> List[Dict]:
        query = {}
        if ext: query["ext"] = ext
        if date: query["date"] = date
        cursor = self.login_entries.find(query).sort("created_at", DESCENDING)
        results = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if isinstance(doc.get("created_at"), datetime):
                doc["created_at"] = doc["created_at"].isoformat()
            results.append(doc)
        return results

    async def delete_login_entry(self, entry_id: str) -> bool:
        result = await self.login_entries.delete_one({"_id": ObjectId(entry_id)})
        return result.deleted_count > 0

    # ── Lead CRM Entries ──────────────────────────────────────────────────────

    async def add_lead_entry(self, ext: str, agent_name: str, date: str,
                             lead_type: str, lead_text: str,
                             user_id: str, user_name: str, employee_id: str = "") -> Dict:
        doc = {
            "ext": ext, "agent_name": agent_name, "date": date,
            "lead_type": lead_type, "lead_text": lead_text,
            "added_by_id": user_id, "added_by_name": user_name,
            "added_by_employee_id": employee_id,
            "created_at": get_ist_now(),
        }
        result = await self.lead_entries.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        doc["created_at"] = doc["created_at"].isoformat()
        return doc

    async def get_lead_entries(self, ext: Optional[str] = None, date: Optional[str] = None) -> List[Dict]:
        query = {}
        if ext: query["ext"] = ext
        if date: query["date"] = date
        cursor = self.lead_entries.find(query).sort("created_at", DESCENDING)
        results = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if isinstance(doc.get("created_at"), datetime):
                doc["created_at"] = doc["created_at"].isoformat()
            results.append(doc)
        return results

    async def delete_lead_entry(self, entry_id: str) -> bool:
        result = await self.lead_entries.delete_one({"_id": ObjectId(entry_id)})
        return result.deleted_count > 0
