"""
Async Database Wrapper
======================
Wraps synchronous database calls to prevent blocking the event loop
when multiple users access the system concurrently.
"""

import asyncio
from typing import Optional, Dict, Any, List
from concurrent.futures import ThreadPoolExecutor
import logging

logger = logging.getLogger(__name__)

# Thread pool for database operations
db_executor = ThreadPoolExecutor(max_workers=500, thread_name_prefix="db_worker")

class AsyncDBWrapper:
    """Async wrapper for synchronous database operations"""
    
    @staticmethod
    async def get_user_async(users_db, user_id: str) -> Optional[Dict[str, Any]]:
        """Async wrapper for users_db.get_user()"""
        if not user_id:
            return None
        
        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(db_executor, users_db.get_user, user_id)
        except Exception as e:
            logger.error(f"Error in async get_user for {user_id}: {e}")
            return None
    
    @staticmethod 
    async def get_department_async(departments_db, dept_id: str) -> Optional[Dict[str, Any]]:
        """Async wrapper for departments_db.get_department()"""
        if not dept_id:
            return None
            
        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(db_executor, departments_db.get_department, dept_id)
        except Exception as e:
            logger.error(f"Error in async get_department for {dept_id}: {e}")
            return None
    
    @staticmethod
    async def get_status_async(leads_db, status_id: str) -> Optional[Dict[str, Any]]:
        """Async wrapper for leads_db.get_status_by_id()"""
        if not status_id:
            return None
            
        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(db_executor, leads_db.get_status_by_id, status_id)
        except Exception as e:
            logger.error(f"Error in async get_status for {status_id}: {e}")
            return None
    
    @staticmethod
    async def get_sub_status_async(leads_db, sub_status_id: str) -> Optional[Dict[str, Any]]:
        """Async wrapper for leads_db.get_sub_status_by_id()"""
        if not sub_status_id:
            return None
            
        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(db_executor, leads_db.get_sub_status_by_id, sub_status_id)
        except Exception as e:
            logger.error(f"Error in async get_sub_status for {sub_status_id}: {e}")
            return None

    @staticmethod
    async def batch_get_users_async(users_db, user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """Batch async wrapper for multiple user lookups"""
        if not user_ids:
            return {}
        
        # Remove duplicates and None values
        unique_user_ids = list(set(filter(None, user_ids)))
        
        # Create tasks for concurrent execution
        tasks = [
            AsyncDBWrapper.get_user_async(users_db, user_id)
            for user_id in unique_user_ids
        ]
        
        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Build result dictionary
        user_dict = {}
        for user_id, result in zip(unique_user_ids, results):
            if isinstance(result, Exception):
                logger.error(f"Error getting user {user_id}: {result}")
                user_dict[user_id] = None
            else:
                user_dict[user_id] = result
        
        return user_dict
    
    @staticmethod
    async def batch_get_departments_async(departments_db, dept_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """Batch async wrapper for multiple department lookups"""
        if not dept_ids:
            return {}
        
        # Remove duplicates and None values
        unique_dept_ids = list(set(filter(None, dept_ids)))
        
        # Create tasks for concurrent execution
        tasks = [
            AsyncDBWrapper.get_department_async(departments_db, dept_id)
            for dept_id in unique_dept_ids
        ]
        
        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Build result dictionary
        dept_dict = {}
        for dept_id, result in zip(unique_dept_ids, results):
            if isinstance(result, Exception):
                logger.error(f"Error getting department {dept_id}: {result}")
                dept_dict[dept_id] = None
            else:
                dept_dict[dept_id] = result
        
        return dept_dict
    
    @staticmethod
    async def batch_get_statuses_async(leads_db, status_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """Batch async wrapper for multiple status lookups"""
        if not status_ids:
            return {}
        
        # Remove duplicates and None values
        unique_status_ids = list(set(filter(None, status_ids)))
        
        # Create tasks for concurrent execution
        tasks = [
            AsyncDBWrapper.get_status_async(leads_db, status_id)
            for status_id in unique_status_ids
        ]
        
        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Build result dictionary
        status_dict = {}
        for status_id, result in zip(unique_status_ids, results):
            if isinstance(result, Exception):
                logger.error(f"Error getting status {status_id}: {result}")
                status_dict[status_id] = None
            else:
                status_dict[status_id] = result
        
        return status_dict
        
    @staticmethod
    async def batch_get_sub_statuses_async(leads_db, sub_status_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """Batch async wrapper for multiple sub-status lookups"""
        if not sub_status_ids:
            return {}
        
        # Remove duplicates and None values
        unique_sub_status_ids = list(set(filter(None, sub_status_ids)))
        
        # Create tasks for concurrent execution
        tasks = [
            AsyncDBWrapper.get_sub_status_async(leads_db, sub_status_id)
            for sub_status_id in unique_sub_status_ids
        ]
        
        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Build result dictionary
        sub_status_dict = {}
        for sub_status_id, result in zip(unique_sub_status_ids, results):
            if isinstance(result, Exception):
                logger.error(f"Error getting sub-status {sub_status_id}: {result}")
                sub_status_dict[sub_status_id] = None
            else:
                sub_status_dict[sub_status_id] = result
        
        return sub_status_dict
