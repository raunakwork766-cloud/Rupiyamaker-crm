"""
Timezone utility functions for IST (Indian Standard Time)
Use these functions throughout the backend to ensure consistent IST timezone
"""

from datetime import datetime, timezone, timedelta

# IST is UTC+5:30
IST = timezone(timedelta(hours=5, minutes=30))

def get_ist_now():
    """
    Get current datetime in IST timezone
    
    Returns:
        datetime: Current datetime in IST
    """
    return datetime.now(IST)

def to_ist(dt):
    """
    Convert a datetime object to IST timezone
    
    Args:
        dt: datetime object (aware or naive)
    
    Returns:
        datetime: Datetime converted to IST
    """
    if dt is None:
        return None
    
    # If datetime is naive (no timezone), assume it's UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    
    # Convert to IST
    return dt.astimezone(IST)

def utc_to_ist(dt):
    """
    Convert UTC datetime to IST
    
    Args:
        dt: datetime object in UTC
    
    Returns:
        datetime: Datetime converted to IST
    """
    if dt is None:
        return None
    
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    
    return dt.astimezone(IST)

def ist_to_utc(dt):
    """
    Convert IST datetime to UTC
    
    Args:
        dt: datetime object in IST
    
    Returns:
        datetime: Datetime converted to UTC
    """
    if dt is None:
        return None
    
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    
    return dt.astimezone(timezone.utc)

def format_ist_datetime(dt, format_string='%Y-%m-%d %H:%M:%S'):
    """
    Format datetime in IST timezone
    
    Args:
        dt: datetime object
        format_string: strftime format string
    
    Returns:
        str: Formatted datetime string in IST
    """
    if dt is None:
        return None
    
    ist_dt = to_ist(dt)
    return ist_dt.strftime(format_string)

def get_ist_timestamp():
    """
    Get current timestamp in IST as ISO format string
    
    Returns:
        str: ISO formatted timestamp in IST
    """
    return get_ist_now().isoformat()

# For backward compatibility and convenience
def datetime_ist():
    """
    Alias for get_ist_now()
    Can be used as a drop-in replacement for datetime.now()
    
    Returns:
        datetime: Current datetime in IST
    """
    return get_ist_now()

# Export commonly used functions
__all__ = [
    'IST',
    'get_ist_now',
    'to_ist',
    'utc_to_ist',
    'ist_to_utc',
    'format_ist_datetime',
    'get_ist_timestamp',
    'datetime_ist'
]
