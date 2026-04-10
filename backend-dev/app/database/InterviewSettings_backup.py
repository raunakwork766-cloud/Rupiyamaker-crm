from app.database import async_db
from bson import ObjectId
from datetime import datetime
import logging

# Setup logging
logger = logging.getLogger(__name__)

def get_collections():
    """Get interview settings collections"""
    if async_db is None:
        raise Exception("Async database not initialized")
    
    return {
        "job_openings": async_db.interview_job_openings,
        "interview_types": async_db.interview_types,
        "source_portals": async_db.interview_source_portals,
        "sub_statuses": async_db.interview_sub_statuses
    }

def create_interview_settings_indexes():
    """Create indexes for the interview settings collections"""
    try:
        collections = get_collections()
        
        # Note: In async Motor, we can't create indexes synchronously during module import
        # The indexes will be created when the async database is initialized
        logger.info("Interview settings index creation scheduled")
    except Exception as e:
        logger.error(f"Error scheduling interview settings indexes: {e}")

async def create_async_indexes():
    """Create indexes for the interview settings collections (async)"""
    try:
        collections = get_collections()
        
        # Create indexes for job openings
        await collections["job_openings"].create_index([("user_id", 1)])
        await collections["job_openings"].create_index([("name", 1)])
        await collections["job_openings"].create_index([("created_at", -1)])
        
        # Create indexes for interview types
        await collections["interview_types"].create_index([("user_id", 1)])
        await collections["interview_types"].create_index([("name", 1)])
        await collections["interview_types"].create_index([("created_at", -1)])
        
        # Create indexes for source/portals
        await collections["source_portals"].create_index([("user_id", 1)])
        await collections["source_portals"].create_index([("name", 1)])
        await collections["source_portals"].create_index([("created_at", -1)])
        
        # Create indexes for sub-statuses
        await collections["sub_statuses"].create_index([("user_id", 1)])
        await collections["sub_statuses"].create_index([("parent_status_id", 1)])
        await collections["sub_statuses"].create_index([("name", 1)])
        await collections["sub_statuses"].create_index([("order", 1)])
        await collections["sub_statuses"].create_index([("created_at", -1)])
        
        logger.info("Interview settings indexes created successfully")
    except Exception as e:
        logger.error(f"Error creating interview settings indexes: {e}")

# Job Openings CRUD operations
async def create_job_opening(job_opening_data):
    """Create a new job opening"""
    try:
        collections = get_collections()
        job_openings_collection = collections["job_openings"]
        
        # Add timestamps
        current_time = datetime.now()
        job_opening_data.update({
            "created_at": current_time,
            "updated_at": current_time
        })
        
        # Check if job opening already exists for this user
        existing = await job_openings_collection.find_one({
            "user_id": job_opening_data["user_id"],
            "name": job_opening_data["name"]
        })
        
        if existing:
            logger.warning(f"Job opening '{job_opening_data['name']}' already exists for user {job_opening_data['user_id']}")
            return None
        
        # Insert the job opening
        result = await job_openings_collection.insert_one(job_opening_data)
        
        if result.inserted_id:
            # Return the created job opening with _id
            created_job_opening = await job_openings_collection.find_one({"_id": result.inserted_id})
            created_job_opening["_id"] = str(created_job_opening["_id"])
            logger.info(f"Job opening created successfully with ID: {result.inserted_id}")
            return created_job_opening
        
        return None
    except Exception as e:
        logger.error(f"Error creating job opening: {e}")
        return None

async def get_job_openings(user_id):
    """Get all job openings for all users (global settings)"""
    try:
        collections = get_collections()
        job_openings_collection = collections["job_openings"]
        
        # Remove user_id filter to make settings global
        job_openings = list(await job_openings_collection.find(
            {},  # No user filter - get all job openings
            {"_id": 1, "name": 1, "created_at": 1, "user_id": 1}
        ).to_list(length=None))
        
        # Convert ObjectId to string
        for job_opening in job_openings:
            job_opening["_id"] = str(job_opening["_id"])
        
        logger.info(f"Retrieved {len(job_openings)} job openings (global)")
        return job_openings
    except Exception as e:
        logger.error(f"Error retrieving job openings: {e}")
        return []

async def update_job_opening(job_opening_id, user_id, job_opening_data):
    """Update a job opening"""
    try:
        collections = get_collections()
        job_openings_collection = collections["job_openings"]
        
        # Add update timestamp
        job_opening_data["updated_at"] = datetime.now()
        
        result = await job_openings_collection.update_one(
            {"_id": ObjectId(job_opening_id), "user_id": user_id},
            {"$set": job_opening_data}
        )
        
        if result.modified_count > 0:
            logger.info(f"Job opening {job_opening_id} updated successfully")
            return True
        
        logger.warning(f"No job opening found with ID {job_opening_id} for user {user_id}")
        return False
    except Exception as e:
        logger.error(f"Error updating job opening: {e}")
        return False

async def delete_job_opening(job_opening_id, user_id):
    """Delete a job opening"""
    try:
        collections = get_collections()
        job_openings_collection = collections["job_openings"]
        
        result = await job_openings_collection.delete_one({
            "_id": ObjectId(job_opening_id),
            "user_id": user_id
        })
        
        if result.deleted_count > 0:
            logger.info(f"Job opening {job_opening_id} deleted successfully")
            return True
        
        logger.warning(f"No job opening found with ID {job_opening_id} for user {user_id}")
        return False
    except Exception as e:
        logger.error(f"Error deleting job opening: {e}")
        return False

# Interview Types CRUD operations
async def create_interview_type(interview_type_data):
    """Create a new interview type"""
    try:
        # Add timestamps
        current_time = datetime.now()
        interview_type_data.update({
            "created_at": current_time,
            "updated_at": current_time
        })
        
        # Check if interview type already exists for this user
        existing = await interview_types_collection.find_one({
            "user_id": interview_type_data["user_id"],
            "name": interview_type_data["name"]
        })
        
        if existing:
            logger.warning(f"Interview type '{interview_type_data['name']}' already exists for user {interview_type_data['user_id']}")
            return None
        
        # Insert the interview type
        result = await interview_types_collection.insert_one(interview_type_data)
        
        if result.inserted_id:
            # Return the created interview type with _id
            created_interview_type = await interview_types_collection.find_one({"_id": result.inserted_id})
            created_interview_type["_id"] = str(created_interview_type["_id"])
            logger.info(f"Interview type created successfully with ID: {result.inserted_id}")
            return created_interview_type
        
        return None
    except Exception as e:
        logger.error(f"Error creating interview type: {e}")
        return None

async def get_interview_types(user_id):
    """Get all interview types for all users (global settings)"""
    try:
        # Remove user_id filter to make settings global
        interview_types = []
        async for interview_type in interview_types_collection.find(
            {},  # No user filter - get all interview types
            {"_id": 1, "name": 1, "created_at": 1, "user_id": 1}
        ).sort("created_at", -1):
            interview_type["_id"] = str(interview_type["_id"])
            interview_types.append(interview_type)
        
        logger.info(f"Retrieved {len(interview_types)} interview types (global)")
        return interview_types
    except Exception as e:
        logger.error(f"Error retrieving interview types: {e}")
        return []

async def update_interview_type(interview_type_id, user_id, interview_type_data):
    """Update an interview type"""
    try:
        # Add update timestamp
        interview_type_data["updated_at"] = datetime.now()
        
        result = await interview_types_collection.update_one(
            {"_id": ObjectId(interview_type_id), "user_id": user_id},
            {"$set": interview_type_data}
        )
        
        if result.modified_count > 0:
            logger.info(f"Interview type {interview_type_id} updated successfully")
            return True
        
        logger.warning(f"No interview type found with ID {interview_type_id} for user {user_id}")
        return False
    except Exception as e:
        logger.error(f"Error updating interview type: {e}")
        return False

async def delete_interview_type(interview_type_id, user_id):
    """Delete an interview type"""
    try:
        result = await interview_types_collection.delete_one({
            "_id": ObjectId(interview_type_id),
            "user_id": user_id
        })
        
        if result.deleted_count > 0:
            logger.info(f"Interview type {interview_type_id} deleted successfully")
            return True
        
        logger.warning(f"No interview type found with ID {interview_type_id} for user {user_id}")
        return False
    except Exception as e:
        logger.error(f"Error deleting interview type: {e}")
        return False

# Source/Portal CRUD operations
async def create_source_portal(source_portal_data):
    """Create a new source/portal"""
    try:
        # Add timestamps
        current_time = datetime.now()
        source_portal_data.update({
            "created_at": current_time,
            "updated_at": current_time
        })
        
        # Check if source/portal already exists for this user
        existing = await source_portals_collection.find_one({
            "user_id": source_portal_data["user_id"],
            "name": source_portal_data["name"]
        })
        
        if existing:
            logger.warning(f"Source/Portal '{source_portal_data['name']}' already exists for user {source_portal_data['user_id']}")
            return None
        
        # Insert the source/portal
        result = await source_portals_collection.insert_one(source_portal_data)
        
        if result.inserted_id:
            # Return the created source/portal with ID
            created_source_portal = await source_portals_collection.find_one({"_id": result.inserted_id})
            created_source_portal["_id"] = str(created_source_portal["_id"])
            logger.info(f"Source/Portal '{source_portal_data['name']}' created successfully")
            return created_source_portal
        
        return None
    except Exception as e:
        logger.error(f"Error creating source/portal: {e}")
        return None

async def get_source_portals(user_id):
    """Get all source/portals for all users (global settings)"""
    try:
        # Remove user_id filter to make settings global
        source_portals = []
        async for source_portal in source_portals_collection.find(
            {}  # No user filter - get all source/portals
        ).sort("created_at", 1):
            source_portal["_id"] = str(source_portal["_id"])
            source_portals.append(source_portal)
        
        logger.info(f"Retrieved {len(source_portals)} source/portals (global)")
        return source_portals
    except Exception as e:
        logger.error(f"Error getting source/portals: {e}")
        return []

async def update_source_portal(source_portal_id, user_id, update_data):
    """Update a source/portal"""
    try:
        # Add updated timestamp
        update_data["updated_at"] = datetime.now()
        
        # Check if another source/portal with the same name exists
        existing = await source_portals_collection.find_one({
            "user_id": user_id,
            "name": update_data.get("name"),
            "_id": {"$ne": ObjectId(source_portal_id)}
        })
        
        if existing:
            logger.warning(f"Source/Portal with name '{update_data.get('name')}' already exists for user {user_id}")
            return False
        
        result = await source_portals_collection.update_one(
            {"_id": ObjectId(source_portal_id), "user_id": user_id},
            {"$set": update_data}
        )
        
        if result.matched_count > 0:
            logger.info(f"Source/Portal {source_portal_id} updated successfully")
            return True
        
        logger.warning(f"No source/portal found with ID {source_portal_id} for user {user_id}")
        return False
    except Exception as e:
        logger.error(f"Error updating source/portal: {e}")
        return False

async def delete_source_portal(source_portal_id, user_id):
    """Delete a source/portal"""
    try:
        result = await source_portals_collection.delete_one({
            "_id": ObjectId(source_portal_id),
            "user_id": user_id
        })
        
        if result.deleted_count > 0:
            logger.info(f"Source/Portal {source_portal_id} deleted successfully")
            return True
        
        logger.warning(f"No source/portal found with ID {source_portal_id} for user {user_id}")
        return False
    except Exception as e:
        logger.error(f"Error deleting source/portal: {e}")
        return False

# Sub-Status CRUD operations
async def create_sub_status(sub_status_data):
    """Create a new sub-status"""
    try:
        # Add timestamps
        current_time = datetime.now()
        sub_status_data.update({
            "created_at": current_time,
            "updated_at": current_time
        })
        
        # Check if sub-status already exists for this parent status
        existing = await sub_statuses_collection.find_one({
            "parent_status_id": sub_status_data["parent_status_id"],
            "name": sub_status_data["name"]
        })
        
        if existing:
            logger.warning(f"Sub-status with name '{sub_status_data['name']}' already exists for parent status")
            return None
        
        result = await sub_statuses_collection.insert_one(sub_status_data)
        
        if result.inserted_id:
            logger.info(f"Sub-status created with ID: {result.inserted_id}")
            # Return the created sub-status with the ID
            sub_status_data["_id"] = str(result.inserted_id)
            return sub_status_data
        else:
            logger.error("Failed to create sub-status")
            return None
    except Exception as e:
        logger.error(f"Error creating sub-status: {e}")
        return None

async def get_sub_statuses_by_parent(parent_status_id):
    """Get all sub-statuses for a parent status"""
    try:
        sub_statuses = []
        async for sub_status in sub_statuses_collection.find({
            "parent_status_id": parent_status_id,
            "is_active": True
        }).sort("order", 1):
            sub_status["_id"] = str(sub_status["_id"])
            sub_statuses.append(sub_status)
            
        logger.info(f"Retrieved {len(sub_statuses)} sub-statuses for parent {parent_status_id}")
        return sub_statuses
    except Exception as e:
        logger.error(f"Error retrieving sub-statuses: {e}")
        return []

async def get_sub_status(sub_status_id):
    """Get a specific sub-status by ID"""
    try:
        sub_status = await sub_statuses_collection.find_one({"_id": ObjectId(sub_status_id)})
        
        if sub_status:
            sub_status["_id"] = str(sub_status["_id"])
            logger.info(f"Retrieved sub-status: {sub_status_id}")
            return sub_status
        else:
            logger.warning(f"Sub-status not found: {sub_status_id}")
            return None
    except Exception as e:
        logger.error(f"Error retrieving sub-status: {e}")
        return None

async def update_sub_status(sub_status_id, update_data):
    """Update a sub-status"""
    try:
        # Add updated timestamp
        update_data["updated_at"] = datetime.now()
        
        result = await sub_statuses_collection.update_one(
            {"_id": ObjectId(sub_status_id)},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            logger.info(f"Sub-status {sub_status_id} updated successfully")
            return True
        else:
            logger.warning(f"Sub-status {sub_status_id} not found or no changes made")
            return False
    except Exception as e:
        logger.error(f"Error updating sub-status: {e}")
        return False

async def delete_sub_status(sub_status_id):
    """Delete a sub-status"""
    try:
        result = await sub_statuses_collection.delete_one({"_id": ObjectId(sub_status_id)})
        
        if result.deleted_count > 0:
            logger.info(f"Sub-status {sub_status_id} deleted successfully")
            return True
        else:
            logger.warning(f"Sub-status {sub_status_id} not found")
            return False
    except Exception as e:
        logger.error(f"Error deleting sub-status: {e}")
        return False
