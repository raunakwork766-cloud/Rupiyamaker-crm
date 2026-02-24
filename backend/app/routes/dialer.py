from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from app.database import get_database_instances
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dialer", tags=["dialer"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def get_dialer_db():
    return get_database_instances().get("dialer")

def get_users_db_instance():
    return get_database_instances().get("users")


async def _resolve_user_name(user_id: str) -> str:
    """Look up a human-readable name for a user_id from the users collection."""
    try:
        users_db = get_users_db_instance()
        if users_db:
            user = await users_db.get_user(user_id)
            if user:
                return (
                    user.get("name") or user.get("full_name") or
                    user.get("username") or user.get("email") or "Unknown"
                )
    except Exception:
        pass
    return "Unknown"


# ── Schemas ────────────────────────────────────────────────────────────────────

class ToggleRequest(BaseModel):
    ext: str
    agent_name: str
    action: str      # "on" or "off"
    user_id: str


class UploadSaveRequest(BaseModel):
    filename: str
    record_count: int
    file_size: Optional[int] = None
    user_id: str
    agents: List[Dict[str, Any]] = []


class UploadUpdateRequest(BaseModel):
    filename: str
    record_count: int
    file_size: Optional[int] = None
    user_id: str
    agents: List[Dict[str, Any]] = []


# ── Warning Toggle Endpoints ───────────────────────────────────────────────────

@router.post("/toggle")
async def add_toggle_event(body: ToggleRequest):
    """Record a warning toggle ON/OFF event. user_id sent from frontend."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    if body.action not in ("on", "off"):
        raise HTTPException(status_code=400, detail="action must be 'on' or 'off'")

    user_name = await _resolve_user_name(body.user_id)
    event = await db.add_toggle_event(
        ext=body.ext,
        agent_name=body.agent_name,
        action=body.action,
        user_id=body.user_id,
        user_name=user_name,
    )
    return {"success": True, "event": event, "toggled_by_name": user_name}


@router.get("/toggle/history")
async def get_toggle_history(ext: Optional[str] = None):
    """Get all toggle events, optionally filtered by agent ext."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    history = await db.get_toggle_history(ext=ext)
    return {"success": True, "history": history}


@router.get("/toggle/state")
async def get_toggle_state():
    """Get current ON/OFF state for every agent (last event per ext)."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    state = await db.get_current_toggle_state()
    return {"success": True, "state": state}


# ── Upload History Endpoints ────────────────────────────────────────────────────

@router.post("/upload")
async def save_upload(body: UploadSaveRequest):
    """Save a new Excel upload to history."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    user_name = await _resolve_user_name(body.user_id)
    result = await db.save_upload(
        filename=body.filename,
        record_count=body.record_count,
        file_size=body.file_size,
        user_id=body.user_id,
        user_name=user_name,
        agents=body.agents,
    )
    return {"success": True, "id": result["id"]}


@router.put("/upload/{upload_id}")
async def update_upload(upload_id: str, body: UploadUpdateRequest):
    """Replace data in an existing upload history entry."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    user_name = await _resolve_user_name(body.user_id)
    ok = await db.update_upload(
        upload_id=upload_id,
        filename=body.filename,
        record_count=body.record_count,
        file_size=body.file_size,
        user_id=body.user_id,
        user_name=user_name,
        agents=body.agents,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Upload not found")
    return {"success": True}


@router.get("/upload/history")
async def get_upload_history():
    """List all upload history entries (without agents array for speed)."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    history = await db.get_upload_history(include_agents=False)
    return {"success": True, "history": history}


@router.get("/upload/{upload_id}/agents")
async def get_upload_agents(upload_id: str):
    """Load the full agents data for a specific upload entry."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    entry = await db.get_upload_with_agents(upload_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Upload not found")
    return {
        "success": True,
        "agents": entry.get("agents", []),
        "filename": entry.get("filename"),
        "uploaded_by_name": entry.get("uploaded_by_name"),
        "uploaded_at": entry.get("uploaded_at"),
    }


@router.delete("/upload/{upload_id}")
async def delete_upload(upload_id: str):
    """Permanently delete an upload history entry."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    ok = await db.delete_upload(upload_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Upload not found")
    return {"success": True}
