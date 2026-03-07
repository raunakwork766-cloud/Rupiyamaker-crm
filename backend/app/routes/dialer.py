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
                fn = user.get("first_name", "")
                ln = user.get("last_name", "")
                full = f"{fn} {ln}".strip()
                if full:
                    return full
                return (
                    user.get("name") or user.get("full_name") or
                    user.get("username") or user.get("email") or "Unknown"
                )
    except Exception:
        pass
    return "Unknown"


async def _resolve_user_details(user_id: str) -> dict:
    """Look up name + employee_id for a user_id."""
    try:
        users_db = get_users_db_instance()
        if users_db:
            user = await users_db.get_user(user_id)
            if user:
                fn = user.get("first_name", "")
                ln = user.get("last_name", "")
                full = f"{fn} {ln}".strip()
                name = full or user.get("name") or user.get("username") or "Unknown"
                emp_id = user.get("employee_id") or user.get("emp_id") or user.get("code") or ""
                return {"name": name, "employee_id": emp_id}
    except Exception:
        pass
    return {"name": "Unknown", "employee_id": ""}


# ── Schemas ────────────────────────────────────────────────────────────────────

class ToggleRequest(BaseModel):
    ext: str
    agent_name: str
    action: str      # "on" or "off"
    user_id: str
    remarks: Optional[str] = None   # action taken / reason for warning


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
    """Record a warning toggle ON event or remove warning (OFF)."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    if body.action not in ("on", "off", "justified"):
        raise HTTPException(status_code=400, detail="action must be 'on', 'off', or 'justified'")

    user_details = await _resolve_user_details(body.user_id)

    if body.action == "off":
        # Clearing status: delete ALL toggle records for this ext so history is clean
        await db.delete_toggle_events(ext=body.ext)
        return {"success": True, "action": "off", "toggled_by_name": user_details["name"]}
    
    # action == "on": store warning with remarks
    event = await db.add_toggle_event(
        ext=body.ext,
        agent_name=body.agent_name,
        action=body.action,
        user_id=body.user_id,
        user_name=user_details["name"],
        employee_id=user_details["employee_id"],
        remarks=body.remarks or "",
    )
    return {"success": True, "event": event, "toggled_by_name": user_details["name"]}


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


# ── Remarks / Justification Endpoints ──────────────────────────────────────────

class RemarkRequest(BaseModel):
    ext: str
    agent_name: str
    date: str           # "YYYY-MM-DD" date of the dialer entry
    remark_type: str    # e.g. "Training", "Disposal Call", "Meeting", "Other"
    remark_text: str    # free text detail
    time_minutes: int   # time in minutes this remark accounts for
    user_id: str        # CRM user who is adding the remark


@router.post("/remarks")
async def add_remark(body: RemarkRequest):
    """Add a waste-time justification remark for an agent on a date."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    user_details = await _resolve_user_details(body.user_id)
    remark = await db.add_remark(
        ext=body.ext,
        agent_name=body.agent_name,
        date=body.date,
        remark_type=body.remark_type,
        remark_text=body.remark_text,
        time_minutes=body.time_minutes,
        user_id=body.user_id,
        user_name=user_details["name"],
        employee_id=user_details["employee_id"],
    )
    return {"success": True, "remark": remark}


@router.get("/remarks")
async def get_remarks(ext: Optional[str] = None, date: Optional[str] = None):
    """Get justification remarks, optionally filtered by ext and/or date."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    remarks = await db.get_remarks(ext=ext, date=date)
    return {"success": True, "remarks": remarks}


@router.delete("/remarks/{remark_id}")
async def delete_remark(remark_id: str):
    """Delete a single justification remark."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    ok = await db.delete_remark(remark_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Remark not found")
    return {"success": True}


class JustifyRemarkRequest(BaseModel):
    justify_remark: str   # review / approval remark text
    user_id: str          # CRM user who is approving


@router.patch("/remarks/{remark_id}/justify")
async def justify_remark(remark_id: str, body: JustifyRemarkRequest):
    """Mark an existing remark as justified (approved) with a review note."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    user_details = await _resolve_user_details(body.user_id)
    ok = await db.justify_remark(
        remark_id=remark_id,
        justify_remark=body.justify_remark,
        user_id=body.user_id,
        user_name=user_details["name"],
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Remark not found")
    return {"success": True}


@router.patch("/remarks/{remark_id}/unjustify")
async def unjustify_remark(remark_id: str):
    """Remove justified status from a remark."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    ok = await db.unjustify_remark(remark_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Remark not found")
    return {"success": True}


# ── Agent Mapping Endpoints ────────────────────────────────────────────────────

class AgentMappingRequest(BaseModel):
    ext: str
    dialer_name: str = ""
    mapped_name: str = ""
    designation: str = ""
    team: str = ""
    user_id: str


class BulkAgentMappingRequest(BaseModel):
    mappings: List[Dict[str, Any]]
    user_id: str


@router.post("/agent-mapping")
async def upsert_agent_mapping(body: AgentMappingRequest):
    """Create or update an agent ext→name/designation/team mapping."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    user_details = await _resolve_user_details(body.user_id)
    mapping = await db.upsert_agent_mapping(
        ext=body.ext,
        dialer_name=body.dialer_name,
        mapped_name=body.mapped_name,
        designation=body.designation,
        team=body.team,
        user_id=body.user_id,
        user_name=user_details["name"],
    )
    return {"success": True, "mapping": mapping}


@router.post("/agent-mapping/bulk")
async def bulk_upsert_agent_mappings(body: BulkAgentMappingRequest):
    """Bulk create/update agent mappings."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    user_details = await _resolve_user_details(body.user_id)
    count = await db.bulk_upsert_agent_mappings(
        mappings=body.mappings,
        user_id=body.user_id,
        user_name=user_details["name"],
    )
    return {"success": True, "count": count}


@router.get("/agent-mapping")
async def get_agent_mappings():
    """Get all agent mappings."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    mappings = await db.get_all_agent_mappings()
    return {"success": True, "mappings": mappings}


@router.get("/agent-mapping/{ext}")
async def get_agent_mapping(ext: str):
    """Get a single agent mapping by ext."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    mapping = await db.get_agent_mapping(ext)
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return {"success": True, "mapping": mapping}


@router.delete("/agent-mapping/{ext}")
async def delete_agent_mapping(ext: str):
    """Delete an agent mapping by ext."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    ok = await db.delete_agent_mapping(ext)
    if not ok:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return {"success": True}


# ── Agent Profile Endpoints ────────────────────────────────────────────────────

class AgentProfilesRequest(BaseModel):
    profiles: List[Dict[str, Any]]
    user_id: str = ""

@router.get("/agent-profiles")
async def get_all_agent_profiles():
    """Return all saved agent profiles."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    profiles = await db.get_all_agent_profiles()
    return {"success": True, "profiles": profiles}

@router.post("/agent-profiles/bulk")
async def bulk_save_agent_profiles(body: AgentProfilesRequest):
    """Bulk upsert agent profiles (by mapped_name). Removes profiles not in list."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    user_details = await _resolve_user_details(body.user_id)
    count = await db.bulk_save_agent_profiles(body.profiles, body.user_id, user_details.get("name", ""))
    return {"success": True, "count": count}


# ── Login Entry Endpoints ──────────────────────────────────────────────────────

class LoginEntryRequest(BaseModel):
    ext: str
    agent_name: str
    date: str           # "YYYY-MM-DD"
    entry_type: str     # e.g. "On Time", "Late Login", "Early Logout", etc.
    entry_text: str     # free text detail
    user_id: str


@router.post("/login-entries")
async def add_login_entry(body: LoginEntryRequest):
    """Add a login entry for an agent on a date."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    user_details = await _resolve_user_details(body.user_id)
    entry = await db.add_login_entry(
        ext=body.ext, agent_name=body.agent_name, date=body.date,
        entry_type=body.entry_type, entry_text=body.entry_text,
        user_id=body.user_id, user_name=user_details["name"],
        employee_id=user_details["employee_id"],
    )
    return {"success": True, "entry": entry}


@router.get("/login-entries")
async def get_login_entries(ext: Optional[str] = None, date: Optional[str] = None):
    """Get login entries, optionally filtered by ext and/or date."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    entries = await db.get_login_entries(ext=ext, date=date)
    return {"success": True, "entries": entries}


@router.delete("/login-entries/{entry_id}")
async def delete_login_entry(entry_id: str):
    """Delete a single login entry."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    ok = await db.delete_login_entry(entry_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"success": True}


# ── Lead CRM Entry Endpoints ──────────────────────────────────────────────────

class LeadEntryRequest(BaseModel):
    ext: str
    agent_name: str
    date: str           # "YYYY-MM-DD"
    lead_type: str      # e.g. "New Lead", "Follow Up", "Callback", etc.
    lead_text: str      # free text detail
    user_id: str


@router.post("/lead-entries")
async def add_lead_entry(body: LeadEntryRequest):
    """Add a lead CRM entry for an agent on a date."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    user_details = await _resolve_user_details(body.user_id)
    entry = await db.add_lead_entry(
        ext=body.ext, agent_name=body.agent_name, date=body.date,
        lead_type=body.lead_type, lead_text=body.lead_text,
        user_id=body.user_id, user_name=user_details["name"],
        employee_id=user_details["employee_id"],
    )
    return {"success": True, "entry": entry}


@router.get("/lead-entries")
async def get_lead_entries(ext: Optional[str] = None, date: Optional[str] = None):
    """Get lead CRM entries, optionally filtered by ext and/or date."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    entries = await db.get_lead_entries(ext=ext, date=date)
    return {"success": True, "entries": entries}


@router.delete("/lead-entries/{entry_id}")
async def delete_lead_entry(entry_id: str):
    """Delete a single lead CRM entry."""
    db = get_dialer_db()
    if not db:
        raise HTTPException(status_code=503, detail="Dialer DB not available")
    ok = await db.delete_lead_entry(entry_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"success": True}
