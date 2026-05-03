"""
FAQ (Frequently Asked Questions) Routes

Endpoints:
  GET    /faq/categories          – list all categories (all users)
  POST   /faq/categories          – create category  (super admin only)
  PUT    /faq/categories/{id}     – update category  (super admin only)
  DELETE /faq/categories/{id}     – delete category  (super admin only)

  GET    /faq/items               – list items, optional ?category_id & ?search (all users)
  POST   /faq/items               – create item      (super admin only)
  PUT    /faq/items/{id}          – update item      (super admin only)
  DELETE /faq/items/{id}          – delete item      (super admin only)
  POST   /faq/items/reorder       – reorder items    (super admin only)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel
from app.database import get_database_instances
from app.database.FAQ import FAQDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.utils.permissions import PermissionManager
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/faq", tags=["faq"])


# ── Pydantic models ───────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    is_active: Optional[bool] = True

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    order: Optional[int] = None

class FAQItemCreate(BaseModel):
    category_id: str
    question: str
    answer: str
    tags: Optional[List[str]] = []
    is_active: Optional[bool] = True

class FAQItemUpdate(BaseModel):
    category_id: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None
    order: Optional[int] = None

class ReorderRequest(BaseModel):
    item_ids: List[str]


# ── DB dependency helpers ─────────────────────────────────────

def _get_faq_db(db_instances=Depends(get_database_instances)) -> FAQDB:
    return db_instances.get("faq")

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
    """Raise 403 if user is not a super admin."""
    role_name = await PermissionManager.get_user_role(user_id, users_db, roles_db)
    # Super admin roles typically have wildcard ("*") in global permissions
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


# ══════════════════════════════════════════════════════════════
# CATEGORY ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.get("/categories")
async def list_categories(
    user_id: str = Query(...),
    active_only: bool = Query(True),
    faq_db: FAQDB = Depends(_get_faq_db),
):
    if not faq_db:
        raise HTTPException(status_code=503, detail="FAQ database not initialised")
    return await faq_db.get_categories(active_only=active_only)


@router.post("/categories")
async def create_category(
    body: CategoryCreate,
    user_id: str = Query(...),
    faq_db: FAQDB = Depends(_get_faq_db),
    users_db: UsersDB = Depends(_get_users_db),
    roles_db: RolesDB = Depends(_get_roles_db),
):
    if not faq_db:
        raise HTTPException(status_code=503, detail="FAQ database not initialised")
    await _require_super_admin(user_id, users_db, roles_db)
    cat_id = await faq_db.create_category(body.dict())
    return {"id": cat_id, "message": "Category created"}


@router.put("/categories/{category_id}")
async def update_category(
    category_id: str,
    body: CategoryUpdate,
    user_id: str = Query(...),
    faq_db: FAQDB = Depends(_get_faq_db),
    users_db: UsersDB = Depends(_get_users_db),
    roles_db: RolesDB = Depends(_get_roles_db),
):
    if not faq_db:
        raise HTTPException(status_code=503, detail="FAQ database not initialised")
    await _require_super_admin(user_id, users_db, roles_db)
    data = {k: v for k, v in body.dict().items() if v is not None}
    updated = await faq_db.update_category(category_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category updated"}


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: str,
    user_id: str = Query(...),
    faq_db: FAQDB = Depends(_get_faq_db),
    users_db: UsersDB = Depends(_get_users_db),
    roles_db: RolesDB = Depends(_get_roles_db),
):
    if not faq_db:
        raise HTTPException(status_code=503, detail="FAQ database not initialised")
    await _require_super_admin(user_id, users_db, roles_db)
    deleted = await faq_db.delete_category(category_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category and its items deleted"}


# ══════════════════════════════════════════════════════════════
# FAQ ITEM ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.get("/items")
async def list_items(
    user_id: str = Query(...),
    category_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    active_only: bool = Query(True),
    faq_db: FAQDB = Depends(_get_faq_db),
):
    if not faq_db:
        raise HTTPException(status_code=503, detail="FAQ database not initialised")
    return await faq_db.get_items(
        category_id=category_id, active_only=active_only, search=search
    )


@router.get("/items/{item_id}")
async def get_item(
    item_id: str,
    user_id: str = Query(...),
    faq_db: FAQDB = Depends(_get_faq_db),
):
    if not faq_db:
        raise HTTPException(status_code=503, detail="FAQ database not initialised")
    item = await faq_db.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="FAQ item not found")
    return item


@router.post("/items")
async def create_item(
    body: FAQItemCreate,
    user_id: str = Query(...),
    faq_db: FAQDB = Depends(_get_faq_db),
    users_db: UsersDB = Depends(_get_users_db),
    roles_db: RolesDB = Depends(_get_roles_db),
):
    if not faq_db:
        raise HTTPException(status_code=503, detail="FAQ database not initialised")
    await _require_super_admin(user_id, users_db, roles_db)
    item_id = await faq_db.create_item(body.dict())
    return {"id": item_id, "message": "FAQ item created"}


@router.put("/items/{item_id}")
async def update_item(
    item_id: str,
    body: FAQItemUpdate,
    user_id: str = Query(...),
    faq_db: FAQDB = Depends(_get_faq_db),
    users_db: UsersDB = Depends(_get_users_db),
    roles_db: RolesDB = Depends(_get_roles_db),
):
    if not faq_db:
        raise HTTPException(status_code=503, detail="FAQ database not initialised")
    await _require_super_admin(user_id, users_db, roles_db)
    data = {k: v for k, v in body.dict().items() if v is not None}
    updated = await faq_db.update_item(item_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="FAQ item not found")
    return {"message": "FAQ item updated"}


@router.delete("/items/{item_id}")
async def delete_item(
    item_id: str,
    user_id: str = Query(...),
    faq_db: FAQDB = Depends(_get_faq_db),
    users_db: UsersDB = Depends(_get_users_db),
    roles_db: RolesDB = Depends(_get_roles_db),
):
    if not faq_db:
        raise HTTPException(status_code=503, detail="FAQ database not initialised")
    await _require_super_admin(user_id, users_db, roles_db)
    deleted = await faq_db.delete_item(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="FAQ item not found")
    return {"message": "FAQ item deleted"}


@router.post("/items/reorder")
async def reorder_items(
    body: ReorderRequest,
    user_id: str = Query(...),
    faq_db: FAQDB = Depends(_get_faq_db),
    users_db: UsersDB = Depends(_get_users_db),
    roles_db: RolesDB = Depends(_get_roles_db),
):
    if not faq_db:
        raise HTTPException(status_code=503, detail="FAQ database not initialised")
    await _require_super_admin(user_id, users_db, roles_db)
    await faq_db.reorder_items(body.item_ids)
    return {"message": "Items reordered"}
