from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Dict, Optional, Any, Union
from bson import ObjectId
from app.database.Products import ProductsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Leads import LeadsDB
from app.schemas.product_schemas import (
    ProductCreate, ProductUpdate, ProductInDB,
    ProductFormSectionCreate, ProductFormSectionUpdate, ProductFormSectionInDB,
    ProductFormFieldCreate, ProductFormFieldUpdate, ProductFormFieldInDB,
    ProductFormSubmission, ProductFormSubmissionInDB,
    PaginatedResponse
)
from app.utils.common_utils import ObjectIdStr, convert_object_id, generate_sequential_id
from app.database import get_database_instances
from app.utils.permissions import (
    check_permission, get_user_capabilities, 
    get_user_permissions, has_permission
)
from datetime import datetime
from app.utils.timezone import get_ist_now
import math

router = APIRouter(
    prefix="/products",
    tags=["products"]
)

# Dependency to get DB instances
async def get_products_db():
    db_instances = get_database_instances()
    return db_instances["products"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

async def get_leads_db():
    db_instances = get_database_instances()
    return db_instances["leads"]

# Helper function to check field-level permissions
async def check_field_permission(user_id: str, field: Dict, users_db: UsersDB, roles_db: RolesDB) -> bool:
    """
    Check if a user has permission to edit a specific form field
    
    Args:
        user_id: ID of the user
        field: The form field dictionary from the database
        users_db: UsersDB instance
        roles_db: RolesDB instance
        
    Returns:
        bool: True if user has permission, False otherwise
    """
    # Get user and role info
    user = await users_db.get_user(user_id)
    if not user or not user.get("role_id"):
        return False
        
    role = await roles_db.get_role(user["role_id"])
    if not role:
        return False
    
    # Check if user is admin - admins can edit any field
    permissions = role.get("permissions", [])
    is_admin = any(
        perm.get("page") == "admin" and 
        (perm.get("actions") == "*" or "edit" in perm.get("actions", []))
        for perm in permissions
    )
    
    if is_admin:
        return True
    
    # Check field-specific permissions
    if field.get("is_admin_only") and not is_admin:
        return False
        
    if field.get("is_readonly") and not is_admin:
        return False
        
    if field.get("allowed_roles") and user["role_id"] not in field.get("allowed_roles"):
        return False
    
    return True

# ========= Product Management =========

@router.post("/", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_product(
    product: ProductCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a new product"""
    # Check permission
    await check_permission(user_id, "products", "create", users_db, roles_db)
    
    # Generate a sequential product ID (e.g., PRD0001)
    product_code = await generate_sequential_id(products_db.get_collection(), "product_code", "PRD", 4)
    
    # Create the product
    product_dict = product.dict()
    product_dict["product_code"] = product_code
    product_dict["created_by"] = user_id
    product_dict["created_at"] = get_ist_now()
    product_dict["updated_by"] = user_id
    product_dict["updated_at"] = get_ist_now()
    
    product_id = await products_db.create_product(product_dict)
    
    return {"id": product_id, "product_code": product_code}

@router.get("/", response_model=PaginatedResponse)
async def list_products(
    page: int = 1,
    page_size: int = 20,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: int = -1,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    List products with pagination and filtering
    """
    # Check permission
    await check_permission(user_id, "products", "show", users_db, roles_db)
    
    # Build search filter
    filter_dict = {}
    
    if category:
        filter_dict["category"] = category
    
    if status:
        filter_dict["status"] = status
    
    if search:
        # Search in name, description, product_code
        filter_dict["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"product_code": {"$regex": search, "$options": "i"}}
        ]
    
    # Calculate pagination
    skip = (page - 1) * page_size
    
    # Get products
    products = await products_db.list_products(
        filter_dict=filter_dict,
        skip=skip,
        limit=page_size,
        sort_by=sort_by,
        sort_order=sort_order
    )
    
    # Get total count
    total_products = await products_db.count_products(filter_dict)
    
    # Convert ObjectIds to strings and enhance with user info
    enhanced_products = []
    for product in products:
        product_dict = convert_object_id(product)
        
        # Add creator info
        if product.get("created_by"):
            creator = await users_db.get_user(product["created_by"])
            if creator:
                product_dict["creator_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}"
        
        enhanced_products.append(product_dict)
    
    # Calculate total pages
    total_pages = math.ceil(total_products / page_size) if total_products > 0 else 1
    
    return {
        "items": enhanced_products,
        "total": total_products,
        "page": page,
        "page_size": page_size,
        "pages": total_pages
    }

@router.get("/{product_id}", response_model=Dict[str, Any])
async def get_product(
    product_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get a specific product by ID"""
    # Check permission
    await check_permission(user_id, "products", "show", users_db, roles_db)
    
    # Get product
    product = await products_db.get_product(product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found"
        )
    
    # Convert ObjectIds to strings
    product_dict = convert_object_id(product)
    
    # Add creator info
    if product.get("created_by"):
        creator = await users_db.get_user(product["created_by"])
        if creator:
            product_dict["creator_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}"
    
    # Add updater info
    if product.get("updated_by"):
        updater = await users_db.get_user(product["updated_by"])
        if updater:
            product_dict["updater_name"] = f"{updater.get('first_name', '')} {updater.get('last_name', '')}"
    
    # Check user capabilities for this product
    capabilities = await get_user_capabilities(user_id, "products", users_db, roles_db)
    product_dict.update(capabilities)
    
    return product_dict

@router.put("/{product_id}", response_model=Dict[str, str])
async def update_product(
    product_id: ObjectIdStr,
    product_update: ProductUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update a product"""
    # Check permission
    await check_permission(user_id, "products", "edit", users_db, roles_db)
    
    # Check if product exists
    product = await products_db.get_product(product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found"
        )
    
    # Update the product
    update_dict = {k: v for k, v in product_update.dict().items() if v is not None}
    update_dict["updated_by"] = user_id
    update_dict["updated_at"] = get_ist_now()
    
    success = await products_db.update_product(product_id, update_dict)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update product"
        )
    
    return {"message": "Product updated successfully"}

@router.delete("/{product_id}", response_model=Dict[str, str])
async def delete_product(
    product_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a product"""
    # Check permission
    await check_permission(user_id, "products", "delete", users_db, roles_db)
    
    # Check if product exists
    product = await products_db.get_product(product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found"
        )
    
    # Delete the product
    success = await products_db.delete_product(product_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete product"
        )
    
    return {"message": "Product deleted successfully"}

# ========= Product Form Management =========

@router.post("/forms/sections", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_form_section(
    section: ProductFormSectionCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a new form section for products"""
    # Check permission
    await check_permission(user_id, "products", "manage_forms", users_db, roles_db)
    
    # Create the section
    section_dict = section.dict()
    section_dict["created_by"] = user_id
    section_dict["created_at"] = get_ist_now()
    
    section_id = await products_db.create_form_section(section_dict)
    
    return {"id": section_id}

@router.get("/forms/sections", response_model=List[ProductFormSectionInDB])
async def list_form_sections(
    product_id: Optional[str] = None,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    List all form sections
    If product_id is provided, only sections for that product are returned
    """
    # Check permission
    await check_permission(user_id, "products", "show", users_db, roles_db)
    
    # Get form sections
    filter_dict = {}
    if product_id:
        filter_dict["product_id"] = product_id
    
    sections = await products_db.list_form_sections(filter_dict)
    
    # Convert ObjectIds to strings
    return [convert_object_id(section) for section in sections]

@router.put("/forms/sections/{section_id}", response_model=Dict[str, str])
async def update_form_section(
    section_id: ObjectIdStr,
    section_update: ProductFormSectionUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update a form section"""
    # Check permission
    await check_permission(user_id, "products", "manage_forms", users_db, roles_db)
    
    # Check if section exists
    section = await products_db.get_form_section(section_id)
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Form section with ID {section_id} not found"
        )
    
    # Update the section
    update_dict = {k: v for k, v in section_update.dict().items() if v is not None}
    success = await products_db.update_form_section(section_id, update_dict)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update form section"
        )
    
    return {"message": "Form section updated successfully"}

@router.delete("/forms/sections/{section_id}", response_model=Dict[str, str])
async def delete_form_section(
    section_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a form section"""
    # Check permission
    await check_permission(user_id, "products", "manage_forms", users_db, roles_db)
    
    # Check if section exists
    section = await products_db.get_form_section(section_id)
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Form section with ID {section_id} not found"
        )
    
    # Delete the section
    success = await products_db.delete_form_section(section_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete form section"
        )
    
    return {"message": "Form section deleted successfully"}

@router.post("/forms/fields", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def create_form_field(
    field: ProductFormFieldCreate,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Create a new form field for a section"""
    # Check permission
    await check_permission(user_id, "products", "manage_forms", users_db, roles_db)
    
    # Check if section exists
    section = await products_db.get_form_section(field.section_id)
    if not section:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Form section with ID {field.section_id} not found"
        )
    
    # Create the field
    field_dict = field.dict()
    field_dict["created_by"] = user_id
    field_dict["created_at"] = get_ist_now()
    
    field_id = await products_db.create_form_field(field_dict)
    
    return {"id": field_id}

@router.get("/forms/fields", response_model=List[ProductFormFieldInDB])
async def list_form_fields(
    section_id: Optional[str] = None,
    product_id: Optional[str] = None,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    List all form fields
    If section_id is provided, only fields for that section are returned
    If product_id is provided, fields for all sections of that product are returned
    """
    # Check permission
    await check_permission(user_id, "products", "show", users_db, roles_db)
    
    # Get form fields
    fields = await products_db.list_form_fields(section_id, product_id)
    
    # Convert ObjectIds to strings
    return [convert_object_id(field) for field in fields]

@router.put("/forms/fields/{field_id}", response_model=Dict[str, str])
async def update_form_field(
    field_id: ObjectIdStr,
    field_update: ProductFormFieldUpdate,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update a form field"""
    # Check permission
    await check_permission(user_id, "products", "manage_forms", users_db, roles_db)
    
    # Check if field exists
    field = await products_db.get_form_field(field_id)
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Form field with ID {field_id} not found"
        )
    
    # If changing section, verify it exists
    if field_update.section_id and field_update.section_id != field.get("section_id"):
        section = await products_db.get_form_section(field_update.section_id)
        if not section:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Form section with ID {field_update.section_id} not found"
            )
    
    # Update the field
    update_dict = {k: v for k, v in field_update.dict().items() if v is not None}
    success = await products_db.update_form_field(field_id, update_dict)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update form field"
        )
    
    return {"message": "Form field updated successfully"}

@router.delete("/forms/fields/{field_id}", response_model=Dict[str, str])
async def delete_form_field(
    field_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a form field"""
    # Check permission
    await check_permission(user_id, "products", "manage_forms", users_db, roles_db)
    
    # Check if field exists
    field = await products_db.get_form_field(field_id)
    if not field:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Form field with ID {field_id} not found"
        )
    
    # Delete the field
    success = await products_db.delete_form_field(field_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete form field"
        )
    
    return {"message": "Form field deleted successfully"}

# ========= Product Form Submissions =========

@router.post("/forms/submit", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def submit_product_form(
    submission: ProductFormSubmission,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Submit a product form for a lead"""
    # Check permission
    await check_permission(user_id, "products", "submit_forms", users_db, roles_db)
    
    # Check if lead exists
    if submission.lead_id:
        lead = await leads_db.get_lead(submission.lead_id)
        if not lead:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Lead with ID {submission.lead_id} not found"
            )
    
    # Check if product exists
    product = await products_db.get_product(submission.product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with ID {submission.product_id} not found"
        )
    
    # Check field-level permissions
    # Get all form fields for this product
    product_fields = {}
    sections = await products_db.list_form_sections({"product_id": submission.product_id})
    for section in sections:
        fields = await products_db.list_form_fields(str(section["_id"]))
        for field in fields:
            product_fields[str(field["_id"])] = field
    
    # Validate form data against field permissions
    for section_id, fields_data in submission.form_data.items():
        for field_id, field_value in fields_data.items():
            if field_id in product_fields:
                field = product_fields[field_id]
                has_permission = await check_field_permission(user_id, field, users_db, roles_db)
                
                if not has_permission:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"You don't have permission to edit field: {field.get('label')}"
                    )
    
    # Create the submission
    submission_dict = submission.dict()
    submission_dict["created_by"] = user_id
    submission_dict["created_at"] = get_ist_now()
    submission_dict["updated_by"] = user_id
    submission_dict["updated_at"] = get_ist_now()
    
    # Generate a sequential submission ID (e.g., SUB0001)
    submission_code = await generate_sequential_id(products_db.get_submissions_collection(), "submission_code", "SUB", 4)
    submission_dict["submission_code"] = submission_code
    
    submission_id = await products_db.create_form_submission(submission_dict)
    
    return {"id": submission_id, "submission_code": submission_code}

@router.get("/forms/submissions", response_model=PaginatedResponse)
async def list_form_submissions(
    page: int = 1,
    page_size: int = 20,
    product_id: Optional[str] = None,
    lead_id: Optional[str] = None,
    status: Optional[str] = None,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """
    List product form submissions with pagination and filtering
    """
    # Check permission
    await check_permission(user_id, "products", "show", users_db, roles_db)
    
    # Build search filter
    filter_dict = {}
    
    if product_id:
        filter_dict["product_id"] = product_id
    
    if lead_id:
        filter_dict["lead_id"] = lead_id
    
    if status:
        filter_dict["status"] = status
    
    # Calculate pagination
    skip = (page - 1) * page_size
    
    # Get submissions
    submissions = await products_db.list_form_submissions(
        filter_dict=filter_dict,
        skip=skip,
        limit=page_size,
        sort_by="created_at",
        sort_order=-1
    )
    
    # Get total count
    total_submissions = await products_db.count_form_submissions(filter_dict)
    
    # Convert ObjectIds to strings and enhance with user info
    enhanced_submissions = []
    for submission in submissions:
        submission_dict = convert_object_id(submission)
        
        # Add submitter info
        if submission.get("created_by"):
            creator = await users_db.get_user(submission["created_by"])
            if creator:
                submission_dict["submitter_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}"
        
        # Add product info
        if submission.get("product_id"):
            product = await products_db.get_product(submission["product_id"])
            if product:
                submission_dict["product_name"] = product.get("name")
        
        enhanced_submissions.append(submission_dict)
    
    # Calculate total pages
    total_pages = math.ceil(total_submissions / page_size) if total_submissions > 0 else 1
    
    return {
        "items": enhanced_submissions,
        "total": total_submissions,
        "page": page,
        "page_size": page_size,
        "pages": total_pages
    }

@router.get("/forms/submissions/{submission_id}", response_model=Dict[str, Any])
async def get_form_submission(
    submission_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get a specific form submission by ID"""
    # Check permission
    await check_permission(user_id, "products", "show", users_db, roles_db)
    
    # Get submission
    submission = await products_db.get_form_submission(submission_id)
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Form submission with ID {submission_id} not found"
        )
    
    # Convert ObjectIds to strings
    submission_dict = convert_object_id(submission)
    
    # Add submitter info
    if submission.get("created_by"):
        creator = await users_db.get_user(submission["created_by"])
        if creator:
            submission_dict["submitter_name"] = f"{creator.get('first_name', '')} {creator.get('last_name', '')}"
    
    # Add product info
    if submission.get("product_id"):
        product = await products_db.get_product(submission["product_id"])
        if product:
            submission_dict["product_name"] = product.get("name")
    
    # Check user capabilities for this submission
    capabilities = await get_user_capabilities(user_id, "products", users_db, roles_db)
    submission_dict.update(capabilities)
    
    return submission_dict

@router.get("/lead/{lead_id}/forms", response_model=List[Dict[str, Any]])
async def get_lead_form_submissions(
    lead_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    leads_db: LeadsDB = Depends(get_leads_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get all form submissions for a specific lead"""
    # Check if lead exists
    lead = await leads_db.get_lead(lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID {lead_id} not found"
        )
    
    # Check permission - need view permission for both products and leads
    permissions = await get_user_permissions(user_id, users_db, roles_db)
    has_product_view = has_permission(permissions, "products", "show")
    has_lead_view = has_permission(permissions, "leads", "show")
    
    if not (has_product_view and has_lead_view):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to view this information"
        )
    
    # Get submissions for this lead
    submissions = await products_db.list_form_submissions({"lead_id": lead_id})
    
    # Convert ObjectIds to strings and enhance with product info
    enhanced_submissions = []
    for submission in submissions:
        submission_dict = convert_object_id(submission)
        
        # Add product info
        if submission.get("product_id"):
            product = await products_db.get_product(submission["product_id"])
            if product:
                submission_dict["product_name"] = product.get("name")
        
        enhanced_submissions.append(submission_dict)
    
    return enhanced_submissions

@router.put("/forms/submissions/{submission_id}", response_model=Dict[str, str])
async def update_form_submission(
    submission_id: ObjectIdStr,
    submission_update: ProductFormSubmission,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Update a form submission"""
    # Check permission
    await check_permission(user_id, "products", "edit", users_db, roles_db)
    
    # Check if submission exists
    submission = await products_db.get_form_submission(submission_id)
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Form submission with ID {submission_id} not found"
        )
    
    # Check field-level permissions
    product_id = str(submission.get("product_id", ""))
    
    # Get all form fields for this product
    product_fields = {}
    sections = await products_db.list_form_sections({"product_id": product_id})
    for section in sections:
        fields = await products_db.list_form_fields(str(section["_id"]))
        for field in fields:
            product_fields[str(field["_id"])] = field
    
    # Validate form data against field permissions
    for section_id, fields_data in submission_update.form_data.items():
        for field_id, field_value in fields_data.items():
            if field_id in product_fields:
                field = product_fields[field_id]
                has_permission = await check_field_permission(user_id, field, users_db, roles_db)
                
                if not has_permission:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"You don't have permission to edit field: {field.get('label')}"
                    )
    
    # Update the submission
    update_dict = submission_update.dict()
    update_dict["updated_by"] = user_id
    update_dict["updated_at"] = get_ist_now()
    
    success = await products_db.update_form_submission(submission_id, update_dict)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update form submission"
        )
    
    return {"message": "Form submission updated successfully"}

@router.delete("/forms/submissions/{submission_id}", response_model=Dict[str, str])
async def delete_form_submission(
    submission_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Delete a form submission"""
    # Check permission
    await check_permission(user_id, "products", "delete", users_db, roles_db)
    
    # Check if submission exists
    submission = await products_db.get_form_submission(submission_id)
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Form submission with ID {submission_id} not found"
        )
    
    # Delete the submission
    success = await products_db.delete_form_submission(submission_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete form submission"
        )
    
    return {"message": "Form submission deleted successfully"}

# ========= Form Templates =========

@router.get("/forms/templates/{product_id}", response_model=Dict[str, Any])
async def get_product_form_template(
    product_id: ObjectIdStr,
    user_id: str = Query(..., description="ID of the user making the request"),
    products_db: ProductsDB = Depends(get_products_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Get the form template for a product, including all sections and fields"""
    # Check permission
    await check_permission(user_id, "products", "show", users_db, roles_db)
    
    # Check if product exists
    product = await products_db.get_product(product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found"
        )
    
    # Get sections for this product
    sections = await products_db.list_form_sections({"product_id": product_id})
    sections = [convert_object_id(section) for section in sections]
    
    # Get fields for each section
    template = {
        "product_id": str(product_id),
        "product_name": product.get("name"),
        "product_code": product.get("product_code"),
        "sections": []
    }
    
    for section in sections:
        section_id = section["_id"]
        fields = await products_db.list_form_fields(section_id)
        
        # Process fields and add permission info
        enhanced_fields = []
        for field in fields:
            field_dict = convert_object_id(field)
            
            # Check if current user has permission to edit this field
            has_field_permission = await check_field_permission(user_id, field, users_db, roles_db)
            field_dict["can_edit"] = has_field_permission
            
            enhanced_fields.append(field_dict)
        
        template["sections"].append({
            "section_id": section_id,
            "section_name": section.get("name"),
            "section_order": section.get("order", 0),
            "description": section.get("description"),
            "fields": enhanced_fields
        })
    
    # Sort sections by order
    template["sections"].sort(key=lambda x: x["section_order"])
    
    return template
