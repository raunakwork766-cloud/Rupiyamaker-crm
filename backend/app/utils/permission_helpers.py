"""
Permission utility functions that don't depend on database classes.
This module contains standalone permission checking functions to avoid circular imports.
"""

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

def has_permission_for_page_action(permissions, page, action):
    """
    Check if permissions include a specific page and action.
    Handles both string and array formats for actions.
    
    Args:
        permissions: List of permission objects
        page: Page name to check
        action: Action name to check
        
    Returns:
        bool: True if permission exists
    """
    page_lower = page.lower() if page else ""
    action_lower = action.lower() if action else ""
    
    for perm in permissions:
        # Check if page matches
        perm_page = perm.get("page", "")
        page_match = (perm_page in ["*", "any"] or 
                     (perm_page.lower() if perm_page else "") == page_lower)
        
        if page_match:
            actions = perm.get("actions", [])
            
            # Case 1: actions is "*" string (all actions allowed)
            if actions == "*":
                return True
                
            # Case 2: actions is a string that matches the requested action
            if isinstance(actions, str) and actions.lower() == action_lower:
                return True
                
            # Case 3: actions is a list containing either "*" or specific action
            if isinstance(actions, list):
                if "*" in actions:
                    return True
                
                actions_lower = [a.lower() if isinstance(a, str) else a for a in actions]
                if action_lower in actions_lower:
                    return True
    
    return False
