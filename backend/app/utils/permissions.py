"""
Centralized Permission Management System

This module provides a unified way to handle user permissions across all routes.
It includes functions to check permissions, get user roles, and validate access.
"""

from typing import List, Dict, Any, Optional, Union
from fastapi import HTTPException, status
from app.database.Users import UsersDB
from app.database.Roles import RolesDB


# Updated standard permissions based on frontend permission structure
DEFAULT_PERMISSIONS = {
    "global": ["show", "*"],  # show = visibility in menu, * = full system access
    "feeds": ["show", "feeds", "post", "*"],  # show = visibility, feeds = view posts, post = create posts, * = all permissions including delete
    "leads": ["show", "create", "assign", "own", "view_other", "all", "junior", "*"],
    "login": ["show", "own", "view_other", "all", "junior", "*"],
    "tasks": ["show", "create", "edit_others", "*"],
    "tickets": ["show", "own", "junior", "*"],
    "hrms": ["show", "*"],  # General HRMS access
    "employees": ["employees_show", "employees_edit", "employees_create", "employees_delete", "all_employees", "*"],
    "leaves": ["leaves_show", "leaves_own", "leave_admin", "leaves_create", "*"],
    "attendance": ["attendance_show", "attendance_own", "attendance_admin", "attendance_edit", "attendance_mark", "*"],
    "warnings": ["show", "warnings_own", "warnings_admin", "*"],
    "charts": ["show"],
    "emi_calculator": ["show"],
    "settings": ["show", "edit", "*"]  # Settings management permissions
}


class PermissionManager:
    """Centralized permission management class"""
    
    @staticmethod
    async def get_user_permissions(
        user_id: str,
        users_db: UsersDB,
        roles_db: RolesDB
    ) -> List[Dict[str, Any]]:
        """Get a user's permissions based on their role"""
        if not user_id:
            return []
            
        user = await users_db.get_user(user_id)
        if not user or not user.get("role_id"):
            return []
            
        role = await roles_db.get_role(user["role_id"])
        if not role:
            return []
            
        return role.get("permissions", [])

    @staticmethod
    async def get_user_role(
        user_id: str,
        users_db: UsersDB,
        roles_db: RolesDB
    ) -> Optional[Dict[str, Any]]:
        """Get a user's role record"""
        if not user_id:
            return None
            
        user = await users_db.get_user(user_id)
        if not user or not user.get("role_id"):
            return None
            
        role = await roles_db.get_role(user["role_id"])
        return role

    @staticmethod
    def has_permission(permissions: List[Dict[str, Any]], page: str, action: str) -> bool:
        """
        Check if user has permission for a specific page and action.
        Supports wildcards:
        - page="*" or "any" means access to all pages
        - actions="*" means access to all actions (when actions is a string)
        - "*" in actions array means access to all actions (when actions is an array)
        
        Super admin rules:
        - If a permission has page:"*" and actions:"*", the user is considered a super admin with all rights
        
        Note: This function performs case-insensitive comparison for page names and action names
        """
        # Make the input page and action lowercase for case-insensitive comparison
        page_lower = page.lower() if page else ""
        action_lower = action.lower() if action else ""
        
        # First check for super admin permission (strict check: page="*" AND actions="*" or actions=["*"])
        for perm in permissions:
            actions = perm.get("actions")
            is_super_admin = (perm.get("page") == "*" and 
                            (actions == "*" or 
                             (isinstance(actions, list) and "*" in actions)))
            if is_super_admin:
                print(f"DEBUG: User is super admin, granting permission for {page}.{action}")
                return True  # Super admin has all permissions - highest priority check
        
        # Check each permission entry
        for perm in permissions:
            perm_page = perm.get("page", "")
            # Check if page matches (directly or via wildcard)
            # Case-insensitive comparison for page names
            page_match = (perm_page in ["*", "any"] or 
                         (perm_page.lower() if perm_page else "") == page_lower)
            
            if page_match:
                # Check if action matches
                actions = perm.get("actions", [])
                
                # Case 1: actions is "*" string (all actions allowed)
                if actions == "*":
                    print(f"DEBUG: Permission granted for {page}.{action} via wildcard actions")
                    return True
                
                # Case 1.5: actions is "all" string (equivalent to wildcard for all actions)
                if isinstance(actions, str) and actions.lower() == "all":
                    print(f"DEBUG: Permission granted for {page}.{action} via 'all' actions")
                    return True
                    
                # Case 2: actions is a string that matches the requested action (case-insensitive)
                if isinstance(actions, str) and actions.lower() == action_lower:
                    print(f"DEBUG: Permission granted for {page}.{action} via direct string match")
                    return True
                    
                # Case 3: actions is a list containing either "*", "all", or specific action (case-insensitive)
                if isinstance(actions, list):
                    if "*" in actions:
                        print(f"DEBUG: Permission granted for {page}.{action} via wildcard in list")
                        return True
                    
                    # Check for "all" in actions list (case-insensitive)
                    actions_lower = [a.lower() if isinstance(a, str) else a for a in actions]
                    if "all" in actions_lower:
                        print(f"DEBUG: Permission granted for {page}.{action} via 'all' in list")
                        return True
                    
                    # Case-insensitive comparison for each action in the list
                    if action_lower in actions_lower:
                        print(f"DEBUG: Permission granted for {page}.{action} via list of actions (case-insensitive)")
                        return True
        
        print(f"DEBUG: Permission denied for {page}.{action}")
        return False
    
    @staticmethod
    def has_any_page_permission(permissions: List[Dict[str, Any]], pages: List[str], action: str) -> bool:
        """
        Check if user has permission for any of the specified pages and the given action.
        
        Args:
            permissions: List of user permission objects
            pages: List of page/module names to check
            action: The action to check
            
        Returns:
            bool: True if user has permission for any of the pages, False otherwise
        """
        # Check for super admin permission first (strict check: page="*" AND actions="*" or actions=["*"])
        for perm in permissions:
            actions = perm.get("actions")
            is_super_admin = (perm.get("page") == "*" and 
                            (actions == "*" or 
                             (isinstance(actions, list) and "*" in actions)))
            if is_super_admin:
                print(f"DEBUG: User is super admin, granting permission for any of {pages}.{action}")
                return True  # Super admin has all permissions
                
        # Check each page
        for page in pages:
            if PermissionManager.has_permission(permissions, page, action):
                print(f"DEBUG: User has permission for {page}.{action}")
                return True
                
        print(f"DEBUG: User doesn't have permission for any of {pages}.{action}")
        return False

    @staticmethod
    async def check_permission(
        user_id: str,
        page: Union[str, List[str]],
        action: str,
        users_db: UsersDB,
        roles_db: RolesDB,
        raise_error: bool = True
    ) -> bool:
        """
        Check if a user has permission for a specific page and action.
        
        Args:
            user_id: The user ID to check permissions for
            page: The page/module name (e.g., "leads", "users", "roles")
            action: The action to check (e.g., "create", "edit", "delete", "show")
            users_db: UsersDB instance
            roles_db: RolesDB instance
            raise_error: Whether to raise HTTPException if permission denied
            
        Returns:
            bool: True if user has permission, False otherwise
            
        Raises:
            HTTPException: If permission denied and raise_error is True
        """
        permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        
        print(f"DEBUG: Checking permission for user {user_id}, page={page}, action={action}")
        print(f"DEBUG: User has {len(permissions)} permission entries")
        
        # Print each permission entry for debugging
        for i, perm in enumerate(permissions):
            print(f"DEBUG: Permission {i+1}: page={perm.get('page')}, actions={perm.get('actions')}")
        
        if isinstance(page, list):
            has_perm = PermissionManager.has_any_page_permission(permissions, page, action)
            print(f"DEBUG: has_any_page_permission result: {has_perm}")
        else:
            has_perm = PermissionManager.has_permission(permissions, page, action)
            print(f"DEBUG: has_permission result: {has_perm}")
        
        if not has_perm and raise_error:
            page_str = page if isinstance(page, str) else ", ".join(page)
            print(f"DEBUG: Permission denied, raising HTTP 403")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have permission to {action} {page_str}"
            )
        
        return has_perm

    @staticmethod
    async def check_any_permission(
        user_id: str,
        page: str,
        actions: List[str],
        users_db: UsersDB,
        roles_db: RolesDB,
        raise_error: bool = True
    ) -> bool:
        """
        Check if a user has any of the specified permissions for a page.
        
        Args:
            user_id: The user ID to check permissions for
            page: The page/module name
            actions: List of actions to check
            users_db: UsersDB instance
            roles_db: RolesDB instance
            raise_error: Whether to raise HTTPException if no permissions found
            
        Returns:
            bool: True if user has any of the permissions, False otherwise
        """
        permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        
        for action in actions:
            if PermissionManager.has_permission(permissions, page, action):
                return True
        
        if raise_error:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have permission to access {page}"
            )
            
        return False

    @staticmethod
    async def get_user_capabilities(
        user_id: str,
        page: str,
        users_db: UsersDB,
        roles_db: RolesDB
    ) -> Dict[str, bool]:
        """
        Get all capabilities/permissions a user has for a specific page.
        
        Args:
            user_id: The user ID to check permissions for
            page: The page/module name
            users_db: UsersDB instance
            roles_db: RolesDB instance
            
        Returns:
            Dict with boolean values for each action (create, edit, delete, view, etc.)
        """
        permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        
        standard_actions = ["create", "edit", "delete", "show", "assign", "transfer"]
        capabilities = {}
        
        for action in standard_actions:
            capabilities[f"can_{action}"] = PermissionManager.has_permission(permissions, page, action)
            
        return capabilities

    @staticmethod
    async def is_admin(
        user_id: str,
        users_db: UsersDB,
        roles_db: RolesDB
    ) -> bool:
        """
        Check if a user is a super admin (has full permissions).
        A super admin is defined as a user with permission where page:"*"/"any" and actions:"*"
        
        Args:
            user_id: The user ID to check
            users_db: UsersDB instance
            roles_db: RolesDB instance
            
        Returns:
            bool: True if user is a super admin, False otherwise
        """
        permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        
        # Check if user has wildcard permissions
        return any(
            (perm.get("page") in ["*", "any"] and perm.get("actions") == "*")
            for perm in permissions
        )

    @staticmethod
    async def check_lead_visibility(
        lead_id: str,
        user_id: str,
        leads_db,  # Import would create circular dependency
        users_db: UsersDB,
        roles_db: RolesDB
    ) -> bool:
        """
        Check if a user can view a specific lead based on visibility rules.
        
        Args:
            lead_id: The lead ID to check
            user_id: The user ID to check permissions for
            leads_db: LeadsDB instance
            users_db: UsersDB instance
            roles_db: RolesDB instance
            
        Returns:
            bool: True if user can view the lead, False otherwise
        """
        user_role = await PermissionManager.get_user_role(user_id, users_db, roles_db)
        user_permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        
        return await leads_db.is_lead_visible_to_user(lead_id, user_id, user_role, user_permissions, roles_db)

    @staticmethod
    async def get_subordinate_users(
        user_id: str,
        users_db: "UsersDB",  # Import would create circular dependency
        roles_db: RolesDB
    ) -> List[str]:
        """
        Get all users who are in subordinate roles (for junior permission).
        
        Args:
            user_id: The user ID to get subordinates for
            users_db: UsersDB instance  
            roles_db: RolesDB instance
            
        Returns:
            List of user IDs that are in subordinate roles
        """
        print(f"DEBUG: Getting subordinate users for user_id {user_id}")
        user = await users_db.get_user(user_id)
        if not user or not user.get("role_id"):
            print(f"DEBUG: User {user_id} not found or has no role_id")
            return []
            
        user_role_id = user["role_id"]
        print(f"DEBUG: User {user_id} has role_id {user_role_id}")
        
        # Get all subordinate roles
        subordinate_roles = await roles_db.get_all_subordinate_roles(user_role_id)
        
        if not subordinate_roles:
            print(f"DEBUG: No subordinate roles found for role_id {user_role_id}")
            return []
            
        print(f"DEBUG: Found {len(subordinate_roles)} subordinate roles for user {user_id}")
        subordinate_role_ids = [str(role["_id"]) for role in subordinate_roles]
        print(f"DEBUG: Subordinate role IDs: {subordinate_role_ids}")
        
        # Get all users with these subordinate roles
        subordinate_users = await users_db.get_users_by_roles(subordinate_role_ids)
        
        if not subordinate_users:
            print(f"DEBUG: No users found with subordinate roles {subordinate_role_ids}")
            return []
            
        user_ids = [str(user["_id"]) for user in subordinate_users]
        print(f"DEBUG: Found {len(user_ids)} subordinate users: {user_ids}")
        return user_ids

    @staticmethod
    async def can_view_content_from_user(
        viewer_user_id: str,
        content_creator_id: str,
        users_db: "UsersDB",
        roles_db: RolesDB,
        content_type: str = "general"
    ) -> bool:
        """
        Check if a user can view content created by another user based on hierarchical permissions.
        
        Args:
            viewer_user_id: The user who wants to view the content
            content_creator_id: The user who created the content
            users_db: UsersDB instance
            roles_db: RolesDB instance
            content_type: Type of content being viewed (for future extensibility)
            
        Returns:
            bool: True if viewer can see content from creator, False otherwise
        """
        # Users can always view their own content
        if viewer_user_id == content_creator_id:
            return True
            
        # Check if viewer has junior permission for leads specifically
        viewer_permissions = await PermissionManager.get_user_permissions(viewer_user_id, users_db, roles_db)
        
        # Check if the user is a super admin first
        is_super_admin = any(
            perm.get("page") == "*" and 
            (perm.get("actions") == "*" or 
             (isinstance(perm.get("actions"), list) and "*" in perm.get("actions", [])))
            for perm in viewer_permissions
        )
        
        if is_super_admin:
            return True
            
        has_view_junior = any(
            perm.get("page") == "leads" and 
            (
                perm.get("actions") == "*" or
                perm.get("actions") == "junior" or
                (isinstance(perm.get("actions"), list) and ("*" in perm.get("actions", []) or "junior" in perm.get("actions", [])))
            )
            for perm in viewer_permissions
        )
        
        if has_view_junior:
            # Get subordinate users
            subordinate_users = await PermissionManager.get_subordinate_users(viewer_user_id, users_db, roles_db)
            if content_creator_id in subordinate_users:
                return True
                
        return False

    @staticmethod
    async def can_view_lead(
        user_id: str,
        lead: Dict[str, Any],
        users_db: "UsersDB",
        roles_db: RolesDB
    ) -> bool:
        """
        Check if a user can view a specific lead based on permission rules:
        - own: Only see leads that the user created
        - view_other: See leads in which the user was added in assigned_to
        - all: View all leads
        - junior: View leads below the user in hierarchy format
        
        Args:
            user_id: The user ID checking permissions
            lead: The lead document
            users_db: UsersDB instance
            roles_db: RolesDB instance
            
        Returns:
            bool: True if user can view the lead, False otherwise
        """
        # Get user permissions
        user_permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        
        # Check if user is a super admin - can see all leads
        is_super_admin = any(
            (perm.get("page") in ["*", "any"] and 
             (perm.get("actions") == "*" or 
              (isinstance(perm.get("actions"), list) and "*" in perm.get("actions", []))))
            for perm in user_permissions
        )
        
        if is_super_admin:
            return True  # Super admin can see all leads
        
        # Check for leads admin permission - can see all leads
        is_leads_admin = any(
            (perm.get("page") == "leads" and perm.get("actions") == "*")
            for perm in user_permissions
        )
        
        if is_leads_admin:
            return True  # Leads admin can see all leads
        
        # Check for all permission
        has_view_all = any(
            (perm.get("page") == "leads" and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "all" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "all" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        if has_view_all:
            return True  # User can see all leads
        
        # Check for basic show permission
        has_show_permission = any(
            (perm.get("page") == "leads" and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "show" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "show" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        # If user only has "show" permission with no specific view permissions,
        # they should still be able to see all leads
        if has_show_permission:
            # Check if they have any specific view permissions
            has_any_specific_view = has_view_all or any(
                (perm.get("page") == "leads" and 
                 (perm.get("actions") == "own" or 
                  perm.get("actions") == "view_other" or
                  perm.get("actions") == "junior" or
                  (isinstance(perm.get("actions"), list) and 
                   ("own" in perm.get("actions") or 
                    "view_other" in perm.get("actions") or
                    "junior" in perm.get("actions")))))
                for perm in user_permissions
            )
            
            # If they have "show" permission but no specific view permissions, 
            # they can see all leads
            if not has_any_specific_view:
                return True
        
        # UNIVERSAL DEFAULT BEHAVIOR - own is NOT a permission, it's common sense!
        # EVERYONE can see leads they created or are assigned to - NO PERMISSION REQUIRED
        # This is basic functionality that works automatically for all users
        
        # Import ObjectId for proper comparison
        from bson import ObjectId
        
        # Convert user_id to ObjectId if possible for comparison
        try:
            user_object_id = ObjectId(user_id)
        except:
            user_object_id = None
        
        # UNIVERSAL VIEW_OWN: Check if user created the lead (handle both string and ObjectId formats)
        created_by = lead.get("created_by")
        if created_by == user_id or (user_object_id and created_by == user_object_id):
            return True
            
        # UNIVERSAL VIEW_OWN: Check if user is assigned to the lead (handle both string and ObjectId formats)
        assigned_to = lead.get("assigned_to")
        if assigned_to == user_id or (user_object_id and assigned_to == user_object_id):
            return True
            
        # UNIVERSAL VIEW_OWN: Handle assigned_to as array (handle both string and ObjectId formats)
        if isinstance(assigned_to, list):
            if user_id in assigned_to or (user_object_id and user_object_id in assigned_to):
                return True
            
        # Check for view_other permission
        has_view_other = any(
            (perm.get("page") == "leads" and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "view_other" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "view_other" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        # Check if user has view_other permission for additional access
        if has_view_other:
            # Users can view leads where they are in assign_report_to (handle both string and list)
            assign_report_to = lead.get("assign_report_to")
            if assign_report_to:
                if isinstance(assign_report_to, str):
                    if assign_report_to == user_id:
                        return True
                elif isinstance(assign_report_to, list):
                    if user_id in assign_report_to:
                        return True
        
        # Check for junior permission
        has_view_junior = any(
            (perm.get("page") == "leads" and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "junior" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "junior" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        # Check hierarchical permissions if user has junior permission
        if has_view_junior and lead.get("created_by"):
            # Get subordinate users
            subordinate_users = await PermissionManager.get_subordinate_users(user_id, users_db, roles_db)
            
            # Check if lead creator is a subordinate
            if lead.get("created_by") in subordinate_users:
                return True
            
            # Check if lead is assigned to a subordinate
            if isinstance(lead.get("assigned_to"), list):
                for assigned_user in lead.get("assigned_to", []):
                    if assigned_user in subordinate_users:
                        return True
            else:
                if lead.get("assigned_to") in subordinate_users:
                    return True
            
        return False

    @staticmethod
    async def filter_leads_by_hierarchy(
        user_id: str,
        leads: List[Dict[str, Any]],
        users_db: "UsersDB",
        roles_db: RolesDB
    ) -> List[Dict[str, Any]]:
        """
        Filter a list of leads based on permission rules:
        - own: Only see leads that the user created
        - view_other: See leads in which the user was added in assigned_to
        - all: View all leads
        - junior: View leads below the user in hierarchy format
        
        Args:
            user_id: The user ID to filter for
            leads: List of lead documents
            users_db: UsersDB instance
            roles_db: RolesDB instance
            
        Returns:
            Filtered list of leads the user can view
        """
        if not leads:
            return []
            
        # Get user permissions
        user_permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        
        # Check if user is a super admin - can see all leads
        is_super_admin = any(
            (perm.get("page") in ["*", "any"] and 
             (perm.get("actions") == "*" or 
              (isinstance(perm.get("actions"), list) and "*" in perm.get("actions", []))))
            for perm in user_permissions
        )
        
        if is_super_admin:
            return leads  # Super admin can see all leads
        
        # Check for leads admin permission - can see all leads
        is_leads_admin = any(
            (perm.get("page") == "leads" and perm.get("actions") == "*")
            for perm in user_permissions
        )
        
        if is_leads_admin:
            return leads  # Leads admin can see all leads
        
        # Check for all permission
        has_view_all = any(
            (perm.get("page") == "leads" and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "all" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "all" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        if has_view_all:
            return leads  # User can see all leads
        
        # Check for basic show permission
        has_show_permission = any(
            (perm.get("page") == "leads" and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "show" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "show" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        # Check for specific permissions (own is now default, so we only check view_other and junior)
        has_view_other = any(
            (perm.get("page") == "leads" and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "view_other" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "view_other" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        has_view_junior = any(
            (perm.get("page") == "leads" and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "junior" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "junior" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        # If user only has "show" permission with no specific view permissions,
        # they should still be able to see all leads
        if has_show_permission:
            # Check if they have any specific view permissions (own is default, so excluded)
            has_any_specific_view = has_view_other or has_view_junior
            
            # If they have "show" permission but no specific view permissions, 
            # they can see all leads
            if not has_any_specific_view:
                return leads
        
        # Get subordinate users once for efficiency if needed
        subordinate_users = []
        if has_view_junior:
            subordinate_users = await PermissionManager.get_subordinate_users(user_id, users_db, roles_db)
        
        filtered_leads = []
        for lead in leads:
            # UNIVERSAL DEFAULT BEHAVIOR - EVERYONE can see leads they created or are assigned to
            # This works automatically without any permission checks
            
            # Import ObjectId for proper comparison
            from bson import ObjectId
            
            # Convert user_id to ObjectId if possible for comparison
            try:
                user_object_id = ObjectId(user_id)
            except:
                user_object_id = None
            
            # Check if user created the lead (handle both string and ObjectId formats)
            created_by = lead.get("created_by")
            if created_by == user_id or (user_object_id and created_by == user_object_id):
                filtered_leads.append(lead)
                continue
                
            # Check if user is assigned to the lead (handle both string and ObjectId formats)
            assigned_to = lead.get("assigned_to")
            if assigned_to == user_id or (user_object_id and assigned_to == user_object_id):
                filtered_leads.append(lead)
                continue
                
            # Check if user is in assigned_to array (handle both string and ObjectId formats)
            if isinstance(assigned_to, list):
                if user_id in assigned_to or (user_object_id and user_object_id in assigned_to):
                    filtered_leads.append(lead)
                    continue
            
            # Check additional permissions for broader access
            # Check if user has view_other permission for additional access
            if has_view_other:
                # Check if user is in assign_report_to (handle both string and list)
                assign_report_to = lead.get("assign_report_to")
                if assign_report_to:
                    if isinstance(assign_report_to, str):
                        if assign_report_to == user_id:
                            filtered_leads.append(lead)
                            continue
                    elif isinstance(assign_report_to, list):
                        if user_id in assign_report_to:
                            filtered_leads.append(lead)
                            continue
            
            # Check if user has junior permission and lead creator is a subordinate
            if has_view_junior:
                # Check if lead creator is a subordinate
                if lead.get("created_by") in subordinate_users:
                    filtered_leads.append(lead)
                    continue
                
                # Check if lead is assigned to a subordinate
                if isinstance(lead.get("assigned_to"), list):
                    if any(assigned_user in subordinate_users for assigned_user in lead.get("assigned_to", [])):
                        filtered_leads.append(lead)
                        continue
                elif lead.get("assigned_to") in subordinate_users:
                    filtered_leads.append(lead)
                    continue
                
        return filtered_leads

    @staticmethod
    async def get_lead_visibility_filter(
        user_id: str,
        users_db: "UsersDB",
        roles_db: RolesDB
    ) -> Dict[str, Any]:
        """
        Get MongoDB filter for leads that a user can view based on hierarchical permissions.
        
        Implements specific permission rules:
        - own: Only see leads that the user created
        - view_other: See leads where the user is listed as report_to
        - junior: View leads created by users with junior roles
        - all: View all leads in the system
        
        Args:
            user_id: The user ID to create filter for
            users_db: UsersDB instance
            roles_db: RolesDB instance
            
        Returns:
            MongoDB filter dictionary
        """
        print(f"DEBUG: Building lead visibility filter for user {user_id}")
        print(f"=============== DEBUGGING LEAD VISIBILITY ===============")
        # Get user permissions and role
        user_permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        user_role = await PermissionManager.get_user_role(user_id, users_db, roles_db)
        print(f"DEBUG: User {user_id} has role {user_role}")
        print(f"DEBUG: User permissions: {user_permissions}")
        
        # Get user document to check role name
        user_doc = await users_db.get_user(user_id)
        if user_doc and user_doc.get("role_id"):
            role_doc = await roles_db.get_role(user_doc.get("role_id"))
            if role_doc:
                role_name = role_doc.get("name", "").lower()
                print(f"DEBUG: User role name: {role_name}")
                
                # Check if role name contains 'team manager'
                is_team_manager_by_name = "team" in role_name and "manager" in role_name
                print(f"DEBUG: Is Team Manager by role name: {is_team_manager_by_name}")
        
        # Check if user is a super admin - can see all leads
        is_super_admin = any(
            (perm.get("page") in ["*", "any"] and 
             (perm.get("actions") == "*" or 
              (isinstance(perm.get("actions"), list) and "*" in perm.get("actions", []))))
            for perm in user_permissions
        )
        
        if is_super_admin:
            return {}  # Super admin can see all leads, no filter needed
        
        # Check for leads admin permission - can see all regular leads
        is_leads_admin = any(
            (perm.get("page") == "leads" and perm.get("actions") == "*")
            for perm in user_permissions
        )
        
        if is_leads_admin:
            return {"file_sent_to_login": {"$ne": True}}  # All leads except login department leads
        
        # Check for all permission (case-insensitive)
        print(f"DEBUG: Checking for 'all' permission. User permissions: {user_permissions}")
        has_view_all = False
        
        # Enhanced debugging for permission checking
        for perm in user_permissions:
            page = perm.get("page", "")
            actions = perm.get("actions", [])
            
            print(f"DEBUG: Checking permission - page: '{page}', actions: {actions} (type: {type(actions)})")
            
            # Check if page matches leads
            page_matches = page.lower() == "leads"
            
            if page_matches:
                print(f"DEBUG: Page matches 'leads' for permission: {perm}")
                
                # Check for wildcard permission
                if actions == "*":
                    print(f"DEBUG: Found wildcard '*' permission")
                    has_view_all = True
                    break
                
                # Check for string 'all' permission
                if isinstance(actions, str) and actions.lower() == "all":
                    print(f"DEBUG: Found string 'all' permission")
                    has_view_all = True
                    break
                
                # Check for 'all' in array
                if isinstance(actions, list):
                    if "*" in actions:
                        print(f"DEBUG: Found '*' in actions array")
                        has_view_all = True
                        break
                    
                    if any(action.lower() == "all" if isinstance(action, str) else False for action in actions):
                        print(f"DEBUG: Found 'all' in actions array")
                        has_view_all = True
                        break
        
        print(f"DEBUG: Final has_view_all result: {has_view_all}")
        
        if has_view_all:
            # FIXED: "all" permission SHOULD grant access to ALL leads
            # This is the intended behavior when giving "all" permission to a role
            print(f"DEBUG: User has 'all' permission - granting access to ALL leads")
            return {}  # Return empty filter to show ALL leads
        
        # Check for basic view permissio
        has_view_permission = any(
            (perm.get("page") == "leads" and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "show" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "show" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        if not has_view_permission:
            return {"_id": {"$exists": False}}  # Return no results
        
        # UNIVERSAL DEFAULT BEHAVIOR - own is NOT a permission, it's common sense!
        # EVERYONE can see leads they created or are assigned to - NO PERMISSION REQUIRED
        # This is the foundation of the system and works automatically for all users
        
        # Build filter conditions starting with universal own
        filter_conditions = []
        
        print(f"DEBUG: Adding universal own filters for user {user_id} (automatic - no permission needed)")
        
        # Import ObjectId for proper comparison
        from bson import ObjectId
        
        # Create both string and ObjectId versions for comparison
        try:
            user_object_id = ObjectId(user_id)
        except:
            user_object_id = None
        
        # ROLE-BASED VISIBILITY: Different rules for Team Leaders vs Regular Employees
        # Check if user is a Team Leader (has junior or all permission)
        is_team_leader_by_permission = any(
            (perm.get("page", "").lower() == "leads" and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "all" or
              perm.get("actions") == "junior" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "all" in perm.get("actions") or "junior" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        # DESIGNATION IS DISPLAY-ONLY: Only role-based permissions matter
        # Removed designation-based permission logic - designation is purely a job title for display
        is_team_leader = is_team_leader_by_permission
        
        print(f"DEBUG: Is Team Leader (by permission ONLY): {is_team_leader_by_permission} for user {user_id}")
        print(f"DEBUG: Is Team Leader (FINAL): {is_team_leader} for user {user_id}")
        
        # UNIVERSAL: Everyone can see leads they created (handle both string and ObjectId)
        filter_conditions.append({"created_by": user_id})  # String format
        if user_object_id:
            filter_conditions.append({"created_by": user_object_id})  # ObjectId format
        
        # UNIVERSAL: Get user's employee_id for matching (needed for all users now)
        user_employee_id = None
        if not user_doc:
            user_doc = await users_db.get_user(user_id)
        if user_doc:
            user_employee_id = user_doc.get("employee_id") or user_doc.get("employeeId")
            print(f"DEBUG: User employee_id: {user_employee_id}")
        
        # UNIVERSAL: ALL users (including non-team leaders) can see leads assigned to them
        # This allows regular users to see leads where they are assigned via "Assigned TL" field
        print(f"DEBUG: Adding assigned_to and assign_report_to filters for ALL users (user_id: {user_id})")
        
        # All users can see leads assigned to them
        filter_conditions.append({"assigned_to": user_id})  # Direct string match
        filter_conditions.append({"assigned_to": {"$in": [user_id]}})  # String in array
        if user_object_id:
            filter_conditions.append({"assigned_to": user_object_id})  # Direct ObjectId match
            filter_conditions.append({"assigned_to": {"$in": [user_object_id]}})  # ObjectId in array
        if user_employee_id:
            filter_conditions.append({"assigned_to": user_employee_id})  # Employee ID string match
            filter_conditions.append({"assigned_to": {"$in": [user_employee_id]}})  # Employee ID in array
        
        # All users can see leads where they are in assign_report_to (Assigned TL field)
        # CRITICAL: Check both user_id AND employee_id in assign_report_to array
        filter_conditions.append({"assign_report_to": user_id})  # Direct user_id string match
        filter_conditions.append({"assign_report_to": {"$in": [user_id]}})  # user_id in array
        if user_object_id:
            filter_conditions.append({"assign_report_to": user_object_id})  # Direct ObjectId match
            filter_conditions.append({"assign_report_to": {"$in": [user_object_id]}})  # ObjectId in array
        
        # CRITICAL FIX: Check employee_id in assign_report_to array of objects
        if user_employee_id:
            print(f"DEBUG: Adding employee_id filters for assign_report_to: {user_employee_id}")
            # Match employee_id directly in array
            filter_conditions.append({"assign_report_to": user_employee_id})
            filter_conditions.append({"assign_report_to": {"$in": [user_employee_id]}})
            # Match employee_id within objects in array: [{ employee_id: "rm014", name: "..." }]
            filter_conditions.append({"assign_report_to.employee_id": user_employee_id})
            filter_conditions.append({"assign_report_to.employee_id": {"$in": [user_employee_id]}})
            filter_conditions.append({"assign_report_to.employeeId": user_employee_id})
            filter_conditions.append({"assign_report_to": {"$elemMatch": {"employee_id": user_employee_id}}})
            filter_conditions.append({"assign_report_to": {"$elemMatch": {"employeeId": user_employee_id}}})
        
        # Check for view_other permission (case-insensitive)
        has_view_other = any(
            (perm.get("page", "").lower() == "leads" and 
             (perm.get("actions") == "*" or 
              (isinstance(perm.get("actions"), str) and perm.get("actions").lower() == "view_other") or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or 
                any(action.lower() == "view_other" if isinstance(action, str) else False 
                    for action in perm.get("actions", []))))))
            for perm in user_permissions
        )
        
        if has_view_other:
            # Users can see leads where they are listed as report_to (as per requirement)
            filter_conditions.append({"report_to": user_id})
            filter_conditions.append({"report_to": {"$in": [user_id]}})
            
            # Also check for other legacy/alternate field names that might be used
            filter_conditions.append({"assign_report_to": user_id})
            filter_conditions.append({"assign_report_to": {"$in": [user_id]}})
        
        # Check for junior permission (case-insensitive) - RE-ENABLED for multiple reporting support
        has_view_junior = any(
            (perm.get("page", "").lower() == "leads" and 
             (perm.get("actions") == "*" or 
              (isinstance(perm.get("actions"), str) and perm.get("actions").lower() == "junior") or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or 
                any(action.lower() == "junior" if isinstance(action, str) else False 
                    for action in perm.get("actions", []))))))
            for perm in user_permissions
        )
        
        if has_view_junior:
            print(f"DEBUG: User {user_id} has junior permission - checking subordinate users")
            
            # Get all users in subordinate roles (supports multiple reporting relationships)
            subordinate_users = await PermissionManager.get_subordinate_users(user_id, users_db, roles_db)
            
            if subordinate_users:
                subordinate_list = list(subordinate_users)
                print(f"DEBUG: Found {len(subordinate_list)} subordinate users for {user_id}: {subordinate_list}")
                
                # Add subordinate created leads (string format)
                for sub_id in subordinate_list:
                    filter_conditions.append({"created_by": sub_id})
                
                # Add batch condition for subordinates (string)
                filter_conditions.append({"created_by": {"$in": subordinate_list}})
                
                # Convert to ObjectId format for backward compatibility
                subordinate_object_ids = []
                for sub_id in subordinate_list:
                    try:
                        from bson import ObjectId
                        subordinate_object_ids.append(ObjectId(sub_id))
                    except:
                        pass
                
                if subordinate_object_ids:
                    filter_conditions.append({"created_by": {"$in": subordinate_object_ids}})
                    filter_conditions.append({"assigned_to": {"$in": subordinate_object_ids}})
                    filter_conditions.append({"assign_report_to": {"$in": subordinate_object_ids}})
                
                print(f"DEBUG: Added subordinate lead visibility filters for user {user_id}")
            else:
                print(f"DEBUG: No subordinate users found for user {user_id}")
        
        # ========================================================================
        # NEW: TEAM MANAGER ROLE - Can see all team member leads
        # ========================================================================
        # Check for team_manager permission - allows seeing ALL subordinate leads
        has_team_manager_permission = any(
            (perm.get("page", "").lower() == "leads" and 
             (isinstance(perm.get("actions"), str) and perm.get("actions").lower() == "team_manager") or
              (isinstance(perm.get("actions"), list) and 
               any(action.lower() == "team_manager" if isinstance(action, str) else False 
                   for action in perm.get("actions", []))))
            for perm in user_permissions
        )
        
        # DESIGNATION IS DISPLAY-ONLY: Only check role name, NOT designation field
        # Removed designation-based permission logic - designation is purely a job title for display
        is_team_manager_by_role_name = False
        
        if not user_doc:
            user_doc = await users_db.get_user(user_id)
        
        if user_doc and user_doc.get("role_id"):
            # Only check role name (not designation)
            role_doc = await roles_db.get_role(user_doc.get("role_id"))
            if role_doc:
                role_name = role_doc.get("name", "").lower()
                # Check for various team manager role name variations
                is_team_manager_by_role_name = (
                    "team manager" in role_name or
                    "teammanager" in role_name or
                    "team-manager" in role_name or
                    "tm" == role_name or  # Short form
                    role_name.startswith("tm ") or  # TM followed by space
                    role_name.endswith(" tm")  # Space followed by TM
                )
                print(f"DEBUG: Role name '{role_name}' matches Team Manager: {is_team_manager_by_role_name}")
        
        if has_team_manager_permission or is_team_manager_by_role_name:
            if has_team_manager_permission:
                trigger_reason = "team_manager permission"
            else:
                trigger_reason = "role name contains 'team manager'"
            print(f"DEBUG: User {user_id} has TEAM MANAGER access (triggered by: {trigger_reason}) - adding team leads visibility")
            
            # Get the team manager's user document
            if not user_doc:
                user_doc = await users_db.get_user(user_id)
            
            if user_doc:
                from bson import ObjectId
                
                # METHOD 1: Find team members by assigned_tl field (users who report to this Team Manager)
                print(f"DEBUG: Team Manager {user_id} - searching for team members with assigned_tl = {user_id}")
                
                # Try both string and ObjectId formats for user_id
                team_member_filter = {"$or": [
                    {"assigned_tl": user_id},
                    {"assigned_tl": str(user_id)}
                ]}
                
                # If user_id is a valid ObjectId, also try ObjectId format
                if ObjectId.is_valid(str(user_id)):
                    try:
                        team_member_filter["$or"].append({"assigned_tl": ObjectId(str(user_id))})
                    except:
                        pass
                
                # Get all users assigned to this Team Manager
                team_members = await users_db.collection.find(team_member_filter).to_list(None)
                
                if team_members:
                    # Get all user IDs from the team
                    team_member_ids = []
                    team_member_object_ids = []
                    
                    for member in team_members:
                        member_id = str(member.get("_id"))
                        team_member_ids.append(member_id)
                        try:
                            team_member_object_ids.append(ObjectId(member_id))
                        except:
                            pass
                    
                    print(f"DEBUG: Team Manager {user_id} has {len(team_member_ids)} team members (by assigned_tl)")
                    
                    if team_member_ids:
                        # Add team member created leads (string format)
                        for member_id in team_member_ids:
                            filter_conditions.append({"created_by": member_id})
                        
                        # Add team member created leads (batch - string)
                        filter_conditions.append({"created_by": {"$in": team_member_ids}})
                        
                        # Add team member created leads (batch - ObjectId)
                        if team_member_object_ids:
                            filter_conditions.append({"created_by": {"$in": team_member_object_ids}})
                        
                        # Add team member assigned leads
                        filter_conditions.append({"assigned_to": {"$in": team_member_ids}})
                        if team_member_object_ids:
                            filter_conditions.append({"assigned_to": {"$in": team_member_object_ids}})
                        
                        # Add team member TL leads
                        filter_conditions.append({"assign_report_to": {"$in": team_member_ids}})
                        if team_member_object_ids:
                            filter_conditions.append({"assign_report_to": {"$in": team_member_object_ids}})
                        
                        print(f"DEBUG: Added team-based lead filters for Team Manager {user_id}")
                else:
                    print(f"DEBUG: No team members found with assigned_tl = {user_id}")
                    
                    # METHOD 2: Fallback to department-based if no assigned_tl found
                    department_id = user_doc.get("department_id")
                    print(f"DEBUG: Falling back to department-based filtering, department_id = {department_id}")
                    
                    if department_id:
                        # Get all users in the same department
                        
                        # Try both string and ObjectId formats for department
                        dept_filter = {"$or": [
                            {"department_id": department_id},
                            {"department_id": str(department_id)}
                        ]}
                        
                        # If department_id is a valid ObjectId, also try ObjectId format
                        if ObjectId.is_valid(str(department_id)):
                            try:
                                dept_filter["$or"].append({"department_id": ObjectId(str(department_id))})
                            except:
                                pass
                        
                        # Get all users in the same department
                        department_users = await users_db.collection.find(dept_filter).to_list(None)
                        
                        if department_users:
                            # Get all user IDs from the department (excluding the team manager themselves)
                            team_member_ids = []
                            team_member_object_ids = []
                            
                            for dept_user in department_users:
                                member_id = str(dept_user.get("_id"))
                                if member_id != user_id:  # Don't include self, they're already in filter_conditions
                                    team_member_ids.append(member_id)
                                    try:
                                        team_member_object_ids.append(ObjectId(member_id))
                                    except:
                                        pass
                            
                            print(f"DEBUG: Team Manager {user_id} has {len(team_member_ids)} team members in department (fallback)")
                            
                            if team_member_ids:
                                # Add team member created leads (string format)
                                for member_id in team_member_ids:
                                    filter_conditions.append({"created_by": member_id})
                                
                                # Add team member created leads (batch - string)
                                filter_conditions.append({"created_by": {"$in": team_member_ids}})
                                
                                # Add team member created leads (batch - ObjectId)
                                if team_member_object_ids:
                                    filter_conditions.append({"created_by": {"$in": team_member_object_ids}})
                                
                                # Add team member assigned leads
                                filter_conditions.append({"assigned_to": {"$in": team_member_ids}})
                                if team_member_object_ids:
                                    filter_conditions.append({"assigned_to": {"$in": team_member_object_ids}})
                                
                                # Add team member TL leads
                                filter_conditions.append({"assign_report_to": {"$in": team_member_ids}})
                                if team_member_object_ids:
                                    filter_conditions.append({"assign_report_to": {"$in": team_member_object_ids}})
                                
                                print(f"DEBUG: Added department-based team lead filters for Team Manager {user_id} (fallback)")
                            else:
                                print(f"DEBUG: No other team members found in department {department_id}")
                        else:
                            print(f"DEBUG: No users found in department {department_id}")
                    else:
                        print(f"DEBUG: Team Manager {user_id} has no department_id - falling back to subordinate roles")
                        # Fallback to subordinate role-based approach
                        subordinate_users = await PermissionManager.get_subordinate_users(user_id, users_db, roles_db)
                        
                        if subordinate_users:
                            subordinate_list = list(subordinate_users)
                            print(f"DEBUG: Team Manager {user_id} has {len(subordinate_list)} subordinate users (role-based fallback)")
                            
                            # Add subordinate created leads
                            for sub_id in subordinate_list:
                                filter_conditions.append({"created_by": sub_id})
                                try:
                                    sub_object_id = ObjectId(sub_id)
                                    filter_conditions.append({"created_by": sub_object_id})
                                except:
                                    pass
                            
                            # Add batch conditions
                            filter_conditions.append({"created_by": {"$in": subordinate_list}})
                            
                            subordinate_object_ids = []
                            for sub_id in subordinate_list:
                                try:
                                    subordinate_object_ids.append(ObjectId(sub_id))
                                except:
                                    pass
                            
                            if subordinate_object_ids:
                                filter_conditions.append({"created_by": {"$in": subordinate_object_ids}})
                                filter_conditions.append({"assigned_to": {"$in": subordinate_object_ids}})
                                filter_conditions.append({"assign_report_to": {"$in": subordinate_object_ids}})
                        else:
                            print(f"DEBUG: No subordinate users found for Team Manager {user_id}")
            else:
                print(f"DEBUG: Could not find user document for Team Manager {user_id}")
        
        
        # ========================================================================
        # STRICT USER-BASED FILTERING: NO department-based visibility
        # ========================================================================
        # Team Leaders should ONLY see leads based on individual user filters
        # NOT based on department (prevents Team Leaders from seeing each other's leads)
        print(f"DEBUG: Building STRICT user-based filter (no department expansion)")
        
        # Build the final filter - ONLY use user-specific conditions
        if filter_conditions:
            print(f"DEBUG: Returning STRICT filter with {len(filter_conditions)} user-specific conditions")
            print(f"DEBUG: User {user_id} can ONLY see leads matching their specific filters")
            # Return ONLY user-specific filters (no department filter)
            return {"$or": filter_conditions}
            
        # If a user has "show" permission but no specific filter conditions,
        # they should see NO leads (for security - don't grant blanket access)
        if has_view_permission:
            print(f"DEBUG: User has show permission but no specific filters - blocking all access for security")
            return {"_id": {"$exists": False}}  # Return no results
            
        # If no permissions at all, return no results
        print(f"DEBUG: No permissions found, blocking all access")
        return {"_id": {"$exists": False}}

    @staticmethod
    async def get_login_visibility_filter(
        user_id: str,
        users_db: "UsersDB",
        roles_db: RolesDB
    ) -> Dict[str, Any]:
        """
        Get MongoDB filter for login leads that a user can view based on LOGIN section permissions.
        
        This is separate from leads section - checks for "login" page permissions specifically.
        
        Implements specific permission rules for LOGIN section:
        - own: Only see login leads that the user created
        - view_other: See login leads where the user is listed as report_to
        - junior: View login leads created by users with junior roles
        - all: View all login leads in the system
        
        Args:
            user_id: The user ID to create filter for
            users_db: UsersDB instance
            roles_db: RolesDB instance
            
        Returns:
            MongoDB filter dictionary
        """
        print(f"DEBUG: Building LOGIN visibility filter for user {user_id}")
        
        # Get user permissions and documents
        user_permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        user_doc = await users_db.get_user(user_id)
        user_role = user_doc.get("role_id") if user_doc else None
        
        print(f"DEBUG: User {user_id} has permissions: {user_permissions}")
        
        # Check for super admin (has global access)
        is_super_admin = any(
            (perm.get("page") == "*" and perm.get("actions") == "*")
            for perm in user_permissions
        )
        
        if is_super_admin:
            print(f"DEBUG: User {user_id} is super admin - accessing all login leads")
            return {}  # Super admin can see all login leads
        
        # Check for login admin permission - can see all login leads
        is_login_admin = any(
            (perm.get("page") == "login" and perm.get("actions") == "*")
            for perm in user_permissions
        )
        
        if is_login_admin:
            print(f"DEBUG: User {user_id} is login admin - accessing all login leads")
            return {}  # Login admin can see all login leads
        
        # Check for all permission (case-insensitive) for LOGIN section
        print(f"DEBUG: Checking for 'all' LOGIN permission. User permissions: {user_permissions}")
        has_view_all = False
        
        # Enhanced debugging for LOGIN permission checking
        for perm in user_permissions:
            page = perm.get("page", "")
            actions = perm.get("actions", [])
            
            print(f"DEBUG: Checking LOGIN permission - page: '{page}', actions: {actions} (type: {type(actions)})")
            
            # Check if page matches LOGIN (not leads)
            page_matches = page.lower() == "login"
            
            if page_matches:
                print(f"DEBUG: Page matches 'login' for permission: {perm}")
                
                # Check for wildcard permission
                if actions == "*":
                    print(f"DEBUG: Found wildcard '*' permission for LOGIN")
                    has_view_all = True
                    break
                
                # Check for string 'all' permission
                if isinstance(actions, str) and actions.lower() == "all":
                    print(f"DEBUG: Found string 'all' permission for LOGIN")
                    has_view_all = True
                    break
                
                # Check for 'all' in array
                if isinstance(actions, list):
                    if "*" in actions:
                        print(f"DEBUG: Found '*' in LOGIN actions array")
                        has_view_all = True
                        break
                    
                    if any(action.lower() == "all" if isinstance(action, str) else False for action in actions):
                        print(f"DEBUG: Found 'all' in LOGIN actions array")
                        has_view_all = True
                        break
        
        print(f"DEBUG: Final LOGIN has_view_all result: {has_view_all}")
        
        if has_view_all:
            print(f"DEBUG: User has 'all' LOGIN permission - granting access to ALL login leads")
            return {}  # Return empty filter to show ALL login leads
        
        # Check for basic LOGIN view permission
        has_view_permission = any(
            (perm.get("page", "").lower() == "login" and 
             ("show" in perm.get("actions", []) if isinstance(perm.get("actions"), list) 
              else perm.get("actions") == "show"))
            for perm in user_permissions
        )
        
        if not has_view_permission:
            print(f"DEBUG: User {user_id} has no LOGIN view permission")
            return {"_id": {"$exists": False}}  # No login access
        
        # Build user-specific filters for LOGIN section
        print(f"DEBUG: Building LOGIN-specific filters for user {user_id}")
        filter_conditions = []
        
        # Import ObjectId for proper comparison
        from bson import ObjectId
        
        # Create both string and ObjectId versions for comparison
        try:
            user_object_id = ObjectId(user_id)
        except:
            user_object_id = None
        
        # Add filter for leads created by this user
        filter_conditions.append({"created_by": user_id})
        if user_object_id:
            filter_conditions.append({"created_by": user_object_id})
        
        # Add filter for leads assigned to this user
        filter_conditions.append({"assigned_to": user_id})
        if user_object_id:
            filter_conditions.append({"assigned_to": user_object_id})
        
        # Add filter for leads where user is report_to
        filter_conditions.append({"assign_report_to": user_id})
        if user_object_id:
            filter_conditions.append({"assign_report_to": user_object_id})
        
        # Check for LOGIN junior/team leader permissions
        has_login_junior = any(
            (perm.get("page", "").lower() == "login" and 
             (isinstance(perm.get("actions"), str) and perm.get("actions").lower() == "junior") or
              (isinstance(perm.get("actions"), list) and 
               any(action.lower() == "junior" if isinstance(action, str) else False 
                   for action in perm.get("actions", []))))
            for perm in user_permissions
        )
        
        if has_login_junior:
            print(f"DEBUG: User {user_id} has LOGIN junior permission")
            # Add subordinate users for LOGIN section
            subordinate_users = await PermissionManager.get_subordinate_users(user_id, users_db, roles_db)
            
            if subordinate_users:
                subordinate_list = list(subordinate_users)
                print(f"DEBUG: User {user_id} has {len(subordinate_list)} subordinate users for LOGIN")
                
                # Add subordinate created leads
                for sub_id in subordinate_list:
                    filter_conditions.append({"created_by": sub_id})
                    try:
                        sub_object_id = ObjectId(sub_id)
                        filter_conditions.append({"created_by": sub_object_id})
                    except:
                        pass
        
        # Build the final LOGIN filter
        if filter_conditions:
            print(f"DEBUG: Returning LOGIN filter with {len(filter_conditions)} conditions")
            return {"$or": filter_conditions}
        
        # If no specific conditions, return no results for security
        print(f"DEBUG: No LOGIN filter conditions - blocking access")
        return {"_id": {"$exists": False}}

    @staticmethod
    async def get_lead_user_capabilities(
        user_id: str,
        lead: Dict[str, Any],
        users_db: "UsersDB",
        roles_db: RolesDB
    ) -> Dict[str, bool]:
        """
        Get specific capabilities a user has for a lead (can_edit, can_delete, etc.).
        
        Implements specific permission rules:
        - Delete permissions: Only lead creator, leads_admin, or login_admin can delete
        
        Args:
            user_id: The user ID to check capabilities for
            lead: The lead document
            users_db: UsersDB instance
            roles_db: RolesDB instance
            
        Returns:
            Dict with boolean values for each capability
        """
        user_permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        
        # Check if user is super admin (has all permissions)
        is_super_admin = any(
            perm.get("page") == "*" and perm.get("actions") == "*"
            for perm in user_permissions
        )
        
        # Check specific lead permissions
        is_leads_admin = any(
            perm.get("page") == "leads" and perm.get("actions") == "*"
            for perm in user_permissions
        )
        
        is_login_admin = any(
            perm.get("page") == "login" and perm.get("actions") == "*"
            for perm in user_permissions
        )
        
        has_edit_permission = is_leads_admin or any(
            perm.get("page") == "leads" and 
            (perm.get("actions") == "edit" or
             (isinstance(perm.get("actions"), list) and "edit" in perm.get("actions", [])))
            for perm in user_permissions
        )
        
        has_assign_permission = is_leads_admin or any(
            perm.get("page") == "leads" and 
            (perm.get("actions") == "assign" or
             (isinstance(perm.get("actions"), list) and "assign" in perm.get("actions", [])))
            for perm in user_permissions
        )
        
        # Determine ownership/assignment
        is_creator = lead.get("created_by") == user_id
        is_assigned = lead.get("assigned_to") == user_id
        
        # Check if user is in assign_report_to (handle both string and list formats)
        assign_report_to = lead.get("assign_report_to")
        is_reporter = False
        if assign_report_to:
            if isinstance(assign_report_to, str):
                is_reporter = assign_report_to == user_id
            elif isinstance(assign_report_to, list):
                is_reporter = user_id in assign_report_to
        
        # Check for subordinate access
        has_view_junior = any(
            (perm.get("page") == "leads" and 
             (perm.get("actions") == "*" or 
              perm.get("actions") == "junior" or
              (isinstance(perm.get("actions"), list) and 
               ("*" in perm.get("actions") or "junior" in perm.get("actions")))))
            for perm in user_permissions
        )
        
        subordinate_users = []
        can_access_via_hierarchy = False
        
        if has_view_junior and lead.get("created_by"):
            subordinate_users = await PermissionManager.get_subordinate_users(user_id, users_db, roles_db)
            can_access_via_hierarchy = lead.get("created_by") in subordinate_users
        
        # Calculate delete permission - Only creator, leads_admin, or login_admin can delete
        can_delete = is_super_admin or is_leads_admin or is_login_admin or is_creator
        
        # Calculate final capabilities
        # Super admin users have all permissions
        if is_super_admin:
            return {
                "can_edit": True,
                "can_delete": True,
                "can_assign": True,
                "can_transfer": True,
                "can_add_notes": True,
                "can_add_tasks": True,
                "can_upload_attachments": True,
                "can_view_all_tabs": True
            }
        
        # Leads admin or login admin have full permissions
        if is_leads_admin or is_login_admin:
            return {
                "can_edit": True,
                "can_delete": True,
                "can_assign": True,
                "can_transfer": True,
                "can_add_notes": True,
                "can_add_tasks": True,
                "can_upload_attachments": True,
                "can_view_all_tabs": True
            }
        
        # Creators can do most things if they have the base permissions
        if is_creator:
            return {
                "can_edit": has_edit_permission,
                "can_delete": True,  # Creator can always delete their own lead
                "can_assign": has_assign_permission,
                "can_transfer": has_assign_permission,  # Same as assign
                "can_add_notes": True,  # Creators can always add notes
                "can_add_tasks": True,  # Creators can always add tasks
                "can_upload_attachments": True,  # Creators can always upload
                "can_view_all_tabs": True
            }
        
        # Assigned users have limited permissions
        if is_assigned:
            return {
                "can_edit": has_edit_permission,  # Can edit if they have permission
                "can_delete": False,  # Assigned users cannot delete unless they're an admin
                "can_assign": False,  # Assigned users cannot reassign
                "can_transfer": False,
                "can_add_notes": True,  # Can add notes for their work
                "can_add_tasks": True,  # Can add tasks for their work
                "can_upload_attachments": True,  # Can upload attachments
                "can_view_all_tabs": True
            }
        
        # Reporters have view and limited edit permissions
        if is_reporter:
            return {
                "can_edit": False,  # Reporters cannot edit lead details
                "can_delete": False, # Reporters cannot delete
                "can_assign": False,
                "can_transfer": False,
                "can_add_notes": True,  # Can add notes for reporting
                "can_add_tasks": False,
                "can_upload_attachments": True,  # Can upload for reporting
                "can_view_all_tabs": True
            }
        
        # Hierarchical access (viewing subordinate's leads)
        if can_access_via_hierarchy:
            return {
                "can_edit": has_edit_permission,
                "can_delete": False,  # Manager cannot delete subordinate's leads
                "can_assign": has_assign_permission,
                "can_transfer": has_assign_permission,
                "can_add_notes": True,  # Supervisors can add notes
                "can_add_tasks": True,  # Supervisors can add tasks
                "can_upload_attachments": True,
                "can_view_all_tabs": True
            }
        
        # Default: no permissions
        return {
            "can_edit": False,
            "can_delete": False,
            "can_assign": False,
            "can_transfer": False,
            "can_add_notes": False,
            "can_add_tasks": False,
            "can_upload_attachments": False,
            "can_view_all_tabs": False
        }

    @staticmethod
    async def can_approve_lead_reassign(
        user_id: str,
        users_db: UsersDB,
        roles_db: RolesDB
    ) -> bool:
        """
        Check if a user can approve lead reassignment requests.
        User must either be an admin or have the 'allow_reassign' permission.
        
        Args:
            user_id: The user ID to check
            users_db: UsersDB instance
            roles_db: RolesDB instance
            
        Returns:
            bool: True if user can approve reassignments, False otherwise
        """
        # Check if user is a super admin first
        is_admin = await PermissionManager.is_admin(user_id, users_db, roles_db)
        if is_admin:
            return True
        
        # If not admin, check for specific permission
        permissions = await PermissionManager.get_user_permissions(user_id, users_db, roles_db)
        
        for permission in permissions:
            # Check if the permission is for leads
            if permission.get("page") == "leads":
                actions = permission.get("actions", [])
                
                # Handle different formats of actions
                if actions == "*":  # All actions allowed
                    return True
                elif isinstance(actions, list) and ("assign" in actions or "allow_reassign" in actions or "*" in actions):
                    return True
                elif actions == "assign" or actions == "allow_reassign":
                    return True
        
        return False
    
    @staticmethod
    def _check_permission_case_insensitive(perm, page_name, action_name=None):
        """
        Helper method to check if a permission matches a page and action, ignoring case.
        
        Args:
            perm: The permission object to check
            page_name: The page name to check for
            action_name: The action name to check for, or None if only checking page
            
        Returns:
            bool: True if permission matches, False otherwise
        """
        # Check page match (case-insensitive)
        perm_page = str(perm.get("page", "")).lower()
        check_page = str(page_name).lower()
        
        page_match = (perm_page in ["*", "any"] or perm_page == check_page)
        
        # If we're only checking for page match, or if page doesn't match, return result
        if not action_name or not page_match:
            return page_match
            
        # Check action match (case-insensitive)
        perm_actions = perm.get("actions")
        check_action = str(action_name).lower()
        
        # Case 1: actions is "*" (wildcard)
        if perm_actions == "*":
            return True
            
        # Case 2: actions is a string
        if isinstance(perm_actions, str):
            return str(perm_actions).lower() == check_action
            
        # Case 3: actions is a list
        if isinstance(perm_actions, list):
            # Convert all actions to lowercase strings for comparison
            actions_lower = [str(a).lower() for a in perm_actions]
            return "*" in actions_lower or check_action in actions_lower
            
        return False
        

# Create a global instance for easy access
permission_manager = PermissionManager()

# Convenience functions for backward compatibility and easier imports
async def get_user_permissions(user_id: str, users_db: UsersDB, roles_db: RolesDB) -> List[Dict[str, Any]]:
    """Get a user's permissions - convenience function"""
    return await permission_manager.get_user_permissions(user_id, users_db, roles_db)

async def get_user_role(user_id: str, users_db: UsersDB, roles_db: RolesDB) -> Optional[Dict[str, Any]]:
    """Get a user's role - convenience function"""
    return await permission_manager.get_user_role(user_id, users_db, roles_db)

def has_permission(permissions: List[Dict[str, Any]], page: str, action: str) -> bool:
    """Check if permissions include specific page/action - convenience function"""
    return permission_manager.has_permission(permissions, page, action)

async def check_permission(user_id: str, page: str, action: str, users_db: UsersDB, roles_db: RolesDB, raise_error: bool = True) -> bool:
    """Check user permission - convenience function"""
    return await permission_manager.check_permission(user_id, page, action, users_db, roles_db, raise_error)

async def check_any_permission(user_id: str, page: str, actions: List[str], users_db: UsersDB, roles_db: RolesDB, raise_error: bool = True) -> bool:
    """Check if user has any of the specified permissions - convenience function"""
    return await permission_manager.check_any_permission(user_id, page, actions, users_db, roles_db, raise_error)

async def get_user_capabilities(user_id: str, page: str, users_db: UsersDB, roles_db: RolesDB) -> Dict[str, bool]:
    """Get user capabilities for a page - convenience function"""
    return await permission_manager.get_user_capabilities(user_id, page, users_db, roles_db)

async def is_admin(user_id: str, users_db: UsersDB, roles_db: RolesDB) -> bool:
    """Check if user is admin - convenience function"""
    return await permission_manager.is_admin(user_id, users_db, roles_db)

async def check_lead_view_permission(lead_id: str, user_id: str, leads_db, users_db: UsersDB, roles_db: RolesDB) -> bool:
    """Check if user can view a specific lead - convenience function"""
    return await permission_manager.check_lead_visibility(lead_id, user_id, leads_db, users_db, roles_db)

async def can_view_content_from_user(viewer_user_id: str, content_creator_id: str, users_db, roles_db, content_type: str = "general") -> bool:
    """Check if user can view content from another user - convenience function"""
    return await permission_manager.can_view_content_from_user(viewer_user_id, content_creator_id, users_db, roles_db, content_type)

async def can_view_lead(user_id: str, lead: Dict[str, Any], users_db, roles_db) -> bool:
    """Check if user can view a specific lead - convenience function"""
    return await permission_manager.can_view_lead(user_id, lead, users_db, roles_db)

async def filter_leads_by_hierarchy(user_id: str, leads: List[Dict[str, Any]], users_db, roles_db) -> List[Dict[str, Any]]:
    """Filter leads by hierarchical permissions - convenience function"""
    return await permission_manager.filter_leads_by_hierarchy(user_id, leads, users_db, roles_db)

async def get_lead_visibility_filter(user_id: str, users_db, roles_db) -> Dict[str, Any]:
    """Get MongoDB filter for lead visibility - convenience function"""
    return await permission_manager.get_lead_visibility_filter(user_id, users_db, roles_db)

async def get_login_visibility_filter(user_id: str, users_db, roles_db) -> Dict[str, Any]:
    """Get MongoDB filter for LOGIN lead visibility - convenience function"""
    return await permission_manager.get_login_visibility_filter(user_id, users_db, roles_db)

async def get_subordinate_users(user_id: str, users_db, roles_db) -> List[str]:
    """Get subordinate users - convenience function"""
    return await permission_manager.get_subordinate_users(user_id, users_db, roles_db)

async def get_lead_user_capabilities(user_id: str, lead: Dict[str, Any], users_db, roles_db) -> Dict[str, bool]:
    """Get user capabilities for a specific lead - convenience function"""
    return await permission_manager.get_lead_user_capabilities(user_id, lead, users_db, roles_db)

async def can_approve_lead_reassign(user_id: str, users_db: UsersDB, roles_db: RolesDB) -> bool:
    """Check if user can approve lead reassignment - convenience function"""
    return await permission_manager.can_approve_lead_reassign(user_id, users_db, roles_db)

def is_super_admin_permission(perm):
    """
    Check if a permission grants super admin access.
    Handles both string and array formats:
    - actions: "*" (string)
    - actions: ["*"] (array)
    
    Args:
        perm: Permission object
        
    Returns:
        bool: True if this is a super admin permission
    """
    page = perm.get("page")
    actions = perm.get("actions")
    
    # Check for super admin page permissions
    if page in ["*", "any"]:
        # Check actions format - support both string and array
        if actions == "*":
            return True
        elif isinstance(actions, list) and "*" in actions:
            return True
    
    return False

def has_super_admin_permissions(permissions):
    """
    Check if a user has super admin permissions.
    
    Args:
        permissions: List of permission objects
        
    Returns:
        bool: True if user has super admin permissions
    """
    return any(is_super_admin_permission(perm) for perm in permissions)


