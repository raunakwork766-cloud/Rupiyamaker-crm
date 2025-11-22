from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import MongoClient
from app.config import Config
import asyncio
import logging

logger = logging.getLogger(__name__)

# ============ SYNC DATABASE (Legacy Support) ============
try:
    # Legacy sync connection for backward compatibility
    legacy_client = MongoClient(Config.MONGO_URI)
    db = legacy_client[Config.COMPANY_NAME]
    logger.info("✓ Legacy sync MongoDB connection established")
except Exception as e:
    logger.error(f"❌ Failed to connect to legacy MongoDB: {e}")
    db = None

# ============ ASYNC DATABASE (New Implementation) ============
async_client = None
async_db = None

# Database instances
users_db = None
leads_db = None
login_leads_db = None  # NEW: Separate collection for login leads
tasks_db = None
roles_db = None
departments_db = None
designations_db = None
attendance_db = None
settings_db = None
tickets_db = None
notifications_db = None
pop_notifications_db = None
leaves_db = None
warnings_db = None
loan_types_db = None
employee_attachments_db = None
employee_remarks_db = None
employee_activity_db = None
products_db = None
holidays_db = None
important_questions_db = None
otp_db = None
feeds_db = None
interviews_db = None
interview_comments_db = None
interview_history_db = None
share_links_db = None
attendance_comments_db = None
attendance_history_db = None
task_comments_db = None
task_history_db = None
email_settings_db = None
admin_emails_db = None
apps_db = None
app_share_links_db = None

async def init_database():
    """Initialize async Motor database connections and all database classes"""
    global async_client, async_db
    global users_db, leads_db, login_leads_db, tasks_db, roles_db, departments_db, designations_db, attendance_db, settings_db, tickets_db, notifications_db, pop_notifications_db, leaves_db, warnings_db, loan_types_db, employee_attachments_db, employee_remarks_db, employee_activity_db, products_db, holidays_db, important_questions_db, otp_db, feeds_db, interviews_db, interview_comments_db, interview_history_db, share_links_db, attendance_comments_db, attendance_history_db, task_comments_db, task_history_db, email_settings_db, admin_emails_db, apps_db, app_share_links_db
    
    try:
        # Create async client and database
        async_client = AsyncIOMotorClient(Config.MONGO_URI)
        async_db = async_client[Config.COMPANY_NAME]
        
        # Test connection
        await async_client.admin.command('ping')
        logger.info("✓ Async Motor MongoDB connection established")
        
        # Initialize core database classes
        from .Users import UsersDB
        from .Leads import LeadsDB
        from .LoginLeads import LoginLeadsDB  # NEW: Login leads database
        from .Tasks import TasksDB
        from .Roles import RolesDB
        from .Departments import DepartmentsDB
        from .Designations import DesignationsDB
        from .Attendance import AttendanceDB
        from .Settings import SettingsDB
        from .Tickets import TicketsDB
        from .Notifications import NotificationsDB
        from .PopNotifications import PopNotificationsDB
        from .Leaves import LeavesDB
        from .Warnings import WarningDB
        from .LoanTypes import LoanTypesDB
        from .EmployeeAttachments import EmployeeAttachmentsDB
        from .EmployeeRemarks import EmployeeRemarksDB
        from .EmployeeActivity import EmployeeActivityDB
        from .Products import ProductsDB
        from .Holidays import HolidaysDB
        from .ImportantQuestions import ImportantQuestionsDB
        from .OTP import OTPDB
        from .Feeds import FeedsDB
        from .Interviews import InterviewsDB
        from .InterviewComments import InterviewCommentsDB
        from .InterviewHistory import InterviewHistoryDB
        from .ShareLinks import ShareLinksDB
        from .AttendanceComments import AttendanceCommentsDB
        from .AttendanceHistory import AttendanceHistoryDB
        from .TaskComments import TaskCommentsDB
        from .TaskHistory import TaskHistoryDB
        from .EmailSettings import EmailSettingsDB
        from .AdminEmails import AdminEmailsDB
        from .Apps import AppsDB
        from .AppShareLinks import AppShareLinksDB
        
        # Create instances with shared database connection
        users_db = UsersDB(async_db)
        leads_db = LeadsDB(async_db)
        login_leads_db = LoginLeadsDB(async_db)  # NEW: Login leads instance
        tasks_db = TasksDB(async_db)
        roles_db = RolesDB(async_db)
        departments_db = DepartmentsDB(async_db)
        designations_db = DesignationsDB(async_db)
        attendance_db = AttendanceDB(async_db)
        settings_db = SettingsDB(async_db)
        tickets_db = TicketsDB(async_db)
        notifications_db = NotificationsDB(async_db)
        pop_notifications_db = PopNotificationsDB(async_db)
        leaves_db = LeavesDB(async_db)
        warnings_db = WarningDB(async_db)
        loan_types_db = LoanTypesDB(async_db)
        employee_attachments_db = EmployeeAttachmentsDB(async_db)
        employee_remarks_db = EmployeeRemarksDB(async_db)
        employee_activity_db = EmployeeActivityDB(async_db)
        products_db = ProductsDB(async_db)
        holidays_db = HolidaysDB(async_db)
        important_questions_db = ImportantQuestionsDB(async_db)
        otp_db = OTPDB(async_db)
        feeds_db = FeedsDB(async_db)
        interviews_db = InterviewsDB(async_db)
        interview_comments_db = InterviewCommentsDB(async_db)
        interview_history_db = InterviewHistoryDB(async_db)
        share_links_db = ShareLinksDB(async_db)
        attendance_comments_db = AttendanceCommentsDB(async_db)
        attendance_history_db = AttendanceHistoryDB(async_db)
        task_comments_db = TaskCommentsDB(async_db)
        task_history_db = TaskHistoryDB(async_db)
        email_settings_db = EmailSettingsDB(async_db)
        admin_emails_db = AdminEmailsDB(async_db)
        apps_db = AppsDB(async_db)
        app_share_links_db = AppShareLinksDB(async_db)
        
        # Initialize indexes for all databases
        await users_db.init_indexes()
        await leads_db.init_async()  # LeadsDB has special init method
        await login_leads_db.init_async()  # NEW: Initialize login leads DB
        await tasks_db.init_indexes()
        await roles_db.init_indexes()
        await departments_db.init_indexes()
        await designations_db.init_indexes()
        await attendance_db.init_indexes()
        await settings_db.init_indexes()
        await tickets_db.init_indexes()
        await notifications_db.init_indexes()
        await pop_notifications_db.init_indexes()
        await leaves_db.init_indexes()
        await warnings_db.init_indexes()
        await loan_types_db.init_indexes()
        await employee_attachments_db.init_indexes()
        await employee_remarks_db.init_indexes()
        await employee_activity_db.init_indexes()
        await products_db.init_indexes()
        await holidays_db.init_indexes()
        await important_questions_db.init_indexes()
        await otp_db.init_indexes()
        await feeds_db.init_indexes()
        await interviews_db.create_interview_indexes()
        await interview_comments_db.init_indexes()
        await interview_history_db.init_indexes()
        await share_links_db.init_indexes()
        await attendance_comments_db.init_indexes()
        await attendance_history_db.init_indexes()
        await task_comments_db.init_indexes()
        await task_history_db.init_indexes()
        await email_settings_db.init_indexes()
        await admin_emails_db.init_indexes()
        await apps_db.init_indexes()
        await app_share_links_db.init_indexes()
        
        logger.info("✓ All async database classes initialized with indexes")
        
        return {
            "users": users_db,
            "leads": leads_db,
            "login_leads": login_leads_db,  # NEW: Add login leads to instances
            "tasks": tasks_db,
            "roles": roles_db,
            "departments": departments_db,
            "designations": designations_db,
            "attendance": attendance_db,
            "settings": settings_db,
            "tickets": tickets_db,
            "notifications": notifications_db,
            "pop_notifications": pop_notifications_db,
            "leaves": leaves_db,
            "warnings": warnings_db,
            "loan_types": loan_types_db,
            "employee_attachments": employee_attachments_db,
            "employee_remarks": employee_remarks_db,
            "employee_activity": employee_activity_db,
            "products": products_db,
            "holidays": holidays_db,
            "important_questions": important_questions_db,
            "otp": otp_db,
            "feeds": feeds_db,
            "interviews": interviews_db,
            "interview_comments": interview_comments_db,
            "interview_history": interview_history_db,
            "share_links": share_links_db,
            "attendance_comments": attendance_comments_db,
            "attendance_history": attendance_history_db,
            "task_comments": task_comments_db,
            "task_history": task_history_db,
            "apps": apps_db,
            "app_share_links": app_share_links_db,
            "db": async_db
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize async database: {e}")
        raise

async def close_database():
    """Close async database connections"""
    global async_client
    if async_client:
        async_client.close()
        logger.info("✓ Async database connections closed")

def get_async_db():
    """Get the async database instance"""
    return async_db

def get_database_instances():
    """Get all initialized database instances"""
    return {
        "users": users_db,
        "leads": leads_db,
        "login_leads": login_leads_db,  # NEW: Add login leads to instances
        "tasks": tasks_db,
        "roles": roles_db,
        "departments": departments_db,
        "designations": designations_db,
        "attendance": attendance_db,
        "settings": settings_db,
        "tickets": tickets_db,
        "notifications": notifications_db,
        "pop_notifications": pop_notifications_db,
        "leaves": leaves_db,
        "warnings": warnings_db,
        "loan_types": loan_types_db,
        "employee_attachments": employee_attachments_db,
        "employee_remarks": employee_remarks_db,
        "employee_activity": employee_activity_db,
        "products": products_db,
        "holidays": holidays_db,
        "important_questions": important_questions_db,
        "otp": otp_db,
        "feeds": feeds_db,
        "interviews": interviews_db,
        "interview_comments": interview_comments_db,
        "interview_history": interview_history_db,
        "share_links": share_links_db,
        "attendance_comments": attendance_comments_db,
        "attendance_history": attendance_history_db,
        "task_comments": task_comments_db,
        "task_history": task_history_db,
        "apps": apps_db,
        "app_share_links": app_share_links_db
    }

# Individual database getter functions for FastAPI dependency injection
def get_users_db():
    """Get UsersDB instance"""
    return users_db

def get_leads_db():
    """Get LeadsDB instance"""
    return leads_db

def get_login_leads_db():
    """Get LoginLeadsDB instance"""
    return login_leads_db

def get_tasks_db():
    """Get TasksDB instance"""
    return tasks_db

def get_roles_db():
    """Get RolesDB instance"""
    return roles_db

def get_departments_db():
    """Get DepartmentsDB instance"""
    return departments_db

def get_designations_db():
    """Get DesignationsDB instance"""
    return designations_db

def get_attendance_db():
    """Get AttendanceDB instance"""
    return attendance_db

def get_settings_db():
    """Get SettingsDB instance"""
    return settings_db

def get_tickets_db():
    """Get TicketsDB instance"""
    return tickets_db

def get_notifications_db():
    """Get NotificationsDB instance"""
    return notifications_db

def get_pop_notifications_db():
    """Get PopNotificationsDB instance"""
    return pop_notifications_db

def get_leaves_db():
    """Get LeavesDB instance"""
    return leaves_db

def get_warnings_db():
    """Get WarningDB instance"""
    return warnings_db

def get_loan_types_db():
    """Get LoanTypesDB instance"""
    return loan_types_db

def get_employee_attachments_db():
    """Get EmployeeAttachmentsDB instance"""
    return employee_attachments_db

def get_employee_remarks_db():
    """Get EmployeeRemarksDB instance"""
    return employee_remarks_db

def get_employee_activity_db():
    """Get EmployeeActivityDB instance"""
    return employee_activity_db

def get_products_db():
    """Get ProductsDB instance"""
    return products_db

def get_holidays_db():
    """Get HolidaysDB instance"""
    return holidays_db

def get_important_questions_db():
    """Get ImportantQuestionsDB instance"""
    return important_questions_db

def get_otp_db():
    """Get OTPDB instance"""
    return otp_db

def get_feeds_db():
    """Get FeedsDB instance"""
    return feeds_db

def get_interviews_db():
    """Get InterviewsDB instance"""
    return interviews_db

def get_interview_comments_db():
    """Get InterviewCommentsDB instance"""
    return interview_comments_db

def get_interview_history_db():
    """Get InterviewHistoryDB instance"""
    return interview_history_db

def get_share_links_db():
    """Get ShareLinksDB instance"""
    return share_links_db

def get_attendance_comments_db():
    """Get AttendanceCommentsDB instance"""
    return attendance_comments_db

def get_attendance_history_db():
    """Get AttendanceHistoryDB instance"""
    return attendance_history_db

def get_task_comments_db():
    """Get TaskCommentsDB instance"""
    return task_comments_db

def get_task_history_db():
    """Get TaskHistoryDB instance"""
    return task_history_db

def get_email_settings_db():
    """Get EmailSettingsDB instance"""
    return email_settings_db

def get_admin_emails_db():
    """Get AdminEmailsDB instance"""
    return admin_emails_db

def get_apps_db():
    """Get AppsDB instance"""
    return apps_db

# Health check function
async def health_check():
    """Check database connection health"""
    try:
        if async_client:
            await async_client.admin.command('ping')
            return {"status": "healthy", "database": "connected"}
        else:
            return {"status": "unhealthy", "database": "not_initialized"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}