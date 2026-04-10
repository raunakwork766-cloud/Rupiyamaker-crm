from typing import Dict, Any
from fastapi import UploadFile
from pathlib import Path
import os
import uuid
import shutil
import mimetypes

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
    Save an uploaded file to the specified destination
    Returns file metadata
    """
    # Generate a safe filename to avoid collisions and security issues
    file_extension = os.path.splitext(upload_file.filename)[1]
    safe_filename = f"{uuid.uuid4()}{file_extension}"
    
    file_path = destination / safe_filename
    
    # Create parent directories if they don't exist
    os.makedirs(destination, exist_ok=True)
    
    # Write file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    
    # Return file metadata
    file_size = file_path.stat().st_size
    file_type = get_file_type(upload_file.filename)
    
    return {
        "filename": upload_file.filename,  # Original name
        "file_path": str(file_path),  # Path for storage
        "file_type": file_type,
        "size": file_size
    }

def get_relative_media_url(file_path: str) -> str:
    """
    Convert an absolute file path to a relative URL for the API
    e.g. /path/to/media/leads/123/file.jpg -> /leads/utils/lead-file/123/file.jpg
    """
    # Extract parts after "leads" directory
    parts = file_path.split("media/leads/")
    if len(parts) > 1:
        return f"/leads/utils/lead-file/{parts[1]}"
    return file_path