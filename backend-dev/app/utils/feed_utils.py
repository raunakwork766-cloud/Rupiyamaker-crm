from typing import List, Dict, Any, Optional, Union
import os
from pathlib import Path
import shutil
from fastapi import UploadFile
import mimetypes
import uuid

def get_file_type(filename: str) -> str:
    """
    Determine file type based on extension
    """
    mimetype, _ = mimetypes.guess_type(filename)
    
    if not mimetype:
        return "application/octet-stream"
        
    if mimetype.startswith('image/'):
        return "image"
    elif mimetype.startswith('video/'):
        return "video"
    elif mimetype == 'application/pdf':
        return "pdf"
    elif 'spreadsheet' in mimetype or 'excel' in mimetype:
        return "spreadsheet"
    elif 'document' in mimetype or 'word' in mimetype:
        return "document"
    elif 'presentation' in mimetype or 'powerpoint' in mimetype:
        return "presentation"
    else:
        return "file"

async def save_upload_file(upload_file: UploadFile, destination: Path) -> Dict[str, Any]:
    """
    Save an uploaded file to the specified destination without re-encoding or resizing.
    Returns file metadata
    """
    original_name = upload_file.filename or "upload"
    file_extension = os.path.splitext(original_name)[1]
    safe_filename = f"{uuid.uuid4()}{file_extension}"
    
    file_path = destination / safe_filename
    
    # Read full original bytes — avoids partial writes from stale file pointers
    await upload_file.seek(0)
    content = await upload_file.read()
    with open(file_path, "wb") as buffer:
        buffer.write(content)
    
    file_size = len(content)
    file_type = get_file_type(original_name)
    mime_type = upload_file.content_type or mimetypes.guess_type(original_name)[0] or "application/octet-stream"
    
    return {
        "filename": original_name,
        "file_path": str(file_path).replace("\\", "/"),
        "file_type": file_type,
        "mime_type": mime_type,
        "size": file_size
    }

def check_permission(user_permissions: List[Dict[str, Any]], page: str, action: str) -> bool:
    """
    Check if a user has permission for a specific action on a page
    Handles wildcards - if actions contains "*" then all actions are allowed
    Also handles wildcard page "*" which grants access to all pages
    """
    if not user_permissions:
        return False
        
    for perm in user_permissions:
        # Global wildcard permission for all pages
        if perm.get("page") == "*":
            # Either wildcard action or specific action
            if "*" in perm.get("actions", []) or action in perm.get("actions", []):
                return True
                
        # Match specific page
        elif perm.get("page") == page:
            # Check for wildcard in actions
            if "*" in perm.get("actions", []):
                return True
            # Check for specific action
            if action in perm.get("actions", []):
                return True
                
    return False

def get_relative_media_url(file_path: str) -> str:
    """
    Convert an absolute file path to a relative URL for the API
    e.g. /path/to/media/123/file.jpg -> /media/123/file.jpg
    """
    parts = file_path.split("media/")
    if len(parts) > 1:
        return f"/media/{parts[1]}"
    return file_path