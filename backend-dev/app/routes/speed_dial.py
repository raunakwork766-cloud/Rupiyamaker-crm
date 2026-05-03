"""
Speed Dial Routes
─────────────────
Per-user bookmark tiles (folders + links) for the navbar shortcut page.

Currently restricted to super-admin users (matches the FAQ pattern). Once
permissions are configured later, replace `_require_super_admin` with a
proper page-permission check.

Endpoints (all require ?user_id=):
  GET    /speed-dial/items?parent_id=         – list items in a folder (or root)
  POST   /speed-dial/items                    – create link OR folder
  PUT    /speed-dial/items/{item_id}          – update title/url/image/parent
  DELETE /speed-dial/items/{item_id}          – delete (folder cascades)
  POST   /speed-dial/items/reorder            – persist new order
  POST   /speed-dial/upload-image             – upload a tile image
"""

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from fastapi.responses import JSONResponse
from typing import List, Optional
from pydantic import BaseModel
from pathlib import Path
from uuid import uuid4
import os
import logging

from app.database import get_database_instances
from app.database.SpeedDial import SpeedDialDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.utils.permissions import PermissionManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/speed-dial", tags=["speed-dial"])


# ── Pydantic models ───────────────────────────────────────────

class ItemCreate(BaseModel):
    type: str  # "link" | "folder"
    title: str
    url: Optional[str] = ""
    image_url: Optional[str] = ""
    parent_id: Optional[str] = None


class ItemUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    image_url: Optional[str] = None
    parent_id: Optional[str] = None


class ReorderRequest(BaseModel):
    parent_id: Optional[str] = None
    item_ids: List[str]


# ── DB dependency helpers ─────────────────────────────────────

def _get_speed_dial_db(db_instances=Depends(get_database_instances)) -> SpeedDialDB:
    return db_instances.get("speed_dial")

def _get_users_db(db_instances=Depends(get_database_instances)) -> UsersDB:
    return db_instances["users"]

def _get_roles_db(db_instances=Depends(get_database_instances)) -> RolesDB:
    return db_instances["roles"]


# ── Permission helper ─────────────────────────────────────────

async def _require_super_admin(
    user_id: str,
    users_db: UsersDB,
    roles_db: RolesDB,
):
    """Raise 403 if user is not a super admin (mirrors faq.py)."""
    perms = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
    is_super = any(
        p.get("page") == "*" and (
            p.get("actions") == "*" or
            (isinstance(p.get("actions"), list) and "*" in p.get("actions", []))
        )
        for p in perms
    )
    if not is_super:
        raise HTTPException(status_code=403, detail="Super admin access required")


def _ensure_db(db: SpeedDialDB):
    if not db:
        raise HTTPException(status_code=503, detail="Speed Dial database not initialised")


# ══════════════════════════════════════════════════════════════
# LIST / CRUD
# ══════════════════════════════════════════════════════════════

@router.get("/items")
async def list_items(
    user_id: str = Query(...),
    parent_id: Optional[str] = Query(None),
    db: SpeedDialDB = Depends(_get_speed_dial_db),
    users_db: UsersDB = Depends(_get_users_db),
    roles_db: RolesDB = Depends(_get_roles_db),
):
    _ensure_db(db)
    await _require_super_admin(user_id, users_db, roles_db)
    return await db.list_items(user_id, parent_id)


@router.post("/items")
async def create_item(
    body: ItemCreate,
    user_id: str = Query(...),
    db: SpeedDialDB = Depends(_get_speed_dial_db),
    users_db: UsersDB = Depends(_get_users_db),
    roles_db: RolesDB = Depends(_get_roles_db),
):
    _ensure_db(db)
    await _require_super_admin(user_id, users_db, roles_db)

    if body.type not in ("link", "folder"):
        raise HTTPException(status_code=400, detail="type must be 'link' or 'folder'")
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="title is required")
    if body.type == "link" and not (body.url or "").strip():
        raise HTTPException(status_code=400, detail="url is required for links")

    new_id = await db.create_item(user_id, body.dict())
    return {"id": new_id, "message": "Item created"}


@router.put("/items/{item_id}")
async def update_item(
    item_id: str,
    body: ItemUpdate,
    user_id: str = Query(...),
    db: SpeedDialDB = Depends(_get_speed_dial_db),
    users_db: UsersDB = Depends(_get_users_db),
    roles_db: RolesDB = Depends(_get_roles_db),
):
    _ensure_db(db)
    await _require_super_admin(user_id, users_db, roles_db)
    data = {k: v for k, v in body.dict().items() if v is not None}
    if not data:
        return {"message": "Nothing to update"}
    updated = await db.update_item(item_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Item not found or unchanged")
    return {"message": "Item updated"}


@router.delete("/items/{item_id}")
async def delete_item(
    item_id: str,
    user_id: str = Query(...),
    db: SpeedDialDB = Depends(_get_speed_dial_db),
    users_db: UsersDB = Depends(_get_users_db),
    roles_db: RolesDB = Depends(_get_roles_db),
):
    _ensure_db(db)
    await _require_super_admin(user_id, users_db, roles_db)
    deleted = await db.delete_item(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}


@router.post("/items/reorder")
async def reorder_items(
    body: ReorderRequest,
    user_id: str = Query(...),
    db: SpeedDialDB = Depends(_get_speed_dial_db),
    users_db: UsersDB = Depends(_get_users_db),
    roles_db: RolesDB = Depends(_get_roles_db),
):
    _ensure_db(db)
    await _require_super_admin(user_id, users_db, roles_db)
    await db.reorder(user_id, body.parent_id, body.item_ids)
    return {"message": "Items reordered"}


# ══════════════════════════════════════════════════════════════
# IMAGE UPLOAD
# ══════════════════════════════════════════════════════════════

@router.post("/upload-image")
async def upload_tile_image(
    user_id: str = Query(...),
    image: UploadFile = File(...),
    users_db: UsersDB = Depends(_get_users_db),
    roles_db: RolesDB = Depends(_get_roles_db),
):
    """Upload a tile image for a speed-dial bookmark and return its URL."""
    await _require_super_admin(user_id, users_db, roles_db)

    user = await users_db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    allowed = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
    ext = os.path.splitext(image.filename or "")[1].lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(sorted(allowed))}",
        )

    content = await image.read()
    if len(content) > 5 * 1024 * 1024:  # 5 MB
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")

    upload_dir = Path(__file__).parent.parent.parent / "media" / "speed-dial"
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = f"sd-{uuid4().hex}{ext}"
    file_path = upload_dir / filename
    with open(file_path, "wb") as f:
        f.write(content)

    image_url = f"/media/speed-dial/{filename}"
    logger.info(f"Speed-dial image uploaded: {filename} by user {user_id}")
    return JSONResponse(
        status_code=200,
        content={
            "message": "Image uploaded successfully",
            "image_url": image_url,
            "filename": filename,
        },
    )
