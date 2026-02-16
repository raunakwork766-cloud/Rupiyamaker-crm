# Routes module - All route modules for the API

# Import all route modules to make them available from the package
from . import attendance
from . import apps
from . import app_share_links
from . import charts
from . import department
from . import designations
from . import employee_activity
from . import employee_attachments
from . import employee_remarks
from . import employees
from . import feeds
from . import important_questions
from . import interview_settings
from . import interviews
from . import leadLoginRelated
from . import lead_fields
from . import leads
from . import leaves
from . import loan_types
from . import notifications
from . import otp
from . import pop_notifications
from . import postal
from . import products
from . import reassignment
from . import roles
from . import settings
from . import share_links
from . import tasks
from . import tickets
from . import users
from . import warnings

# List all available modules for import
__all__ = [
    "attendance", 
    "apps",
    "app_share_links", 
    "charts",
    "department",
    "designations",
    "employee_activity",
    "employee_attachments",
    "employee_remarks",
    "employees",
    "feeds",
    "important_questions",
    "interview_settings", 
    "interviews",
    "leadLoginRelated",
    "lead_fields",
    "leads",
    "leaves",
    "loan_types",
    "notifications",
    "otp",
    "pop_notifications",
    "postal",
    "products",
    "reassignment",
    "roles",
    "settings",
    "share_links",
    "tasks",
    "tickets",
    "users",
    "warnings"
]