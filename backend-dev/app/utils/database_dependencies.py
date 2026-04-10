"""
Async Database Dependencies for FastAPI Routes

This module provides dependency injection functions for all database classes,
allowing routes to access async Motor database instances properly.
"""

from fastapi import Depends, HTTPException, status, Request
from typing import Optional

from app.database.Users import UsersDB
from app.database.Leads import LeadsDB
from app.database.Tasks import TasksDB
from app.database.Roles import RolesDB
from app.database.Departments import DepartmentsDB
from app.database.Attendance import AttendanceDB
from app.database.Settings import SettingsDB
from app.database.Tickets import TicketsDB
from app.database.Notifications import NotificationsDB
from app.database.PopNotifications import PopNotificationsDB
from app.database.Leaves import LeavesDB
from app.database.Warnings import WarningDB
from app.database.LoanTypes import LoanTypesDB
from app.database.TaskComments import TaskCommentsDB
from app.database.TaskHistory import TaskHistoryDB
from app.database.TaskComments import TaskCommentsDB
from app.database.TaskHistory import TaskHistoryDB

# Dependency functions to get database instances from app state
def get_users_db(request: Request) -> UsersDB:
    """Get users database instance from app state"""
    if hasattr(request.app.state, 'users_db') and request.app.state.users_db:
        return request.app.state.users_db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Users database not available"
    )

def get_leads_db(request: Request) -> LeadsDB:
    """Get leads database instance from app state"""
    if hasattr(request.app.state, 'leads_db') and request.app.state.leads_db:
        return request.app.state.leads_db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Leads database not available"
    )

def get_tasks_db(request: Request) -> TasksDB:
    """Get tasks database instance from app state"""
    if hasattr(request.app.state, 'tasks_db') and request.app.state.tasks_db:
        return request.app.state.tasks_db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Tasks database not available"
    )

def get_roles_db(request: Request) -> RolesDB:
    """Get roles database instance from app state"""
    if hasattr(request.app.state, 'roles_db') and request.app.state.roles_db:
        return request.app.state.roles_db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Roles database not available"
    )

def get_departments_db(request: Request) -> DepartmentsDB:
    """Get departments database instance from app state"""
    if hasattr(request.app.state, 'departments_db') and request.app.state.departments_db:
        return request.app.state.departments_db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Departments database not available"
    )

def get_attendance_db(request: Request) -> AttendanceDB:
    """Get attendance database instance from app state"""
    if hasattr(request.app.state, 'attendance_db') and request.app.state.attendance_db:
        return request.app.state.attendance_db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Attendance database not available"
    )

def get_settings_db(request: Request) -> SettingsDB:
    """Get settings database instance from app state"""
    if hasattr(request.app.state, 'settings_db') and request.app.state.settings_db:
        return request.app.state.settings_db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Settings database not available"
    )

def get_tickets_db(request: Request) -> TicketsDB:
    """Get tickets database instance from app state"""
    if hasattr(request.app.state, 'tickets_db') and request.app.state.tickets_db:
        return request.app.state.tickets_db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Tickets database not available"
    )

def get_notifications_db(request: Request) -> NotificationsDB:
    """Get notifications database instance from app state"""
    if hasattr(request.app.state, 'notifications_db') and request.app.state.notifications_db:
        return request.app.state.notifications_db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Notifications database not available"
    )

def get_pop_notifications_db(request: Request) -> PopNotificationsDB:
    """Get pop notifications database instance from app state"""
    if hasattr(request.app.state, 'pop_notifications_db') and request.app.state.pop_notifications_db:
        return request.app.state.pop_notifications_db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Pop notifications database not available"
    )

def get_leaves_db(request: Request) -> LeavesDB:
    """Get leaves database instance from app state"""
    if hasattr(request.app.state, 'leaves_db') and request.app.state.leaves_db:
        return request.app.state.leaves_db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Leaves database not available"
    )

def get_warnings_db(request: Request) -> WarningDB:
    """Get warnings database instance from app state"""
    if hasattr(request.app.state, 'warnings_db') and request.app.state.warnings_db:
        return request.app.state.warnings_db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Warnings database not available"
    )

def get_loan_types_db(request: Request) -> LoanTypesDB:
    """Get loan types database instance from app state"""
    if hasattr(request.app.state, 'loan_types_db') and request.app.state.loan_types_db:
        return request.app.state.loan_types_db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Loan types database not available"
    )

def get_task_comments_db(request: Request) -> TaskCommentsDB:
    """Get task comments database instance from app state"""
    if hasattr(request.app.state, 'task_comments_db') and request.app.state.task_comments_db:
        return request.app.state.task_comments_db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Task comments database not available"
    )

def get_task_history_db(request: Request) -> TaskHistoryDB:
    """Get task history database instance from app state"""
    if hasattr(request.app.state, 'task_history_db') and request.app.state.task_history_db:
        return request.app.state.task_history_db
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Task history database not available"
    )

# Legacy compatibility functions (for gradual migration)
def get_users_db_legacy() -> Optional[UsersDB]:
    """Legacy function - use get_users_db(request) instead"""
    return None

def get_leads_db_legacy() -> Optional[LeadsDB]:
    """Legacy function - use get_leads_db(request) instead"""
    return None

def get_tasks_db_legacy() -> Optional[TasksDB]:
    """Legacy function - use get_tasks_db(request) instead"""
    return None
