from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
import os
import uuid
from datetime import datetime
from app.utils.timezone import get_ist_now
import mimetypes
import io
import traceback
import zipfile
import tempfile

from app.database.EmployeeAttachments import EmployeeAttachmentsDB
from app.database.Users import UsersDB
from app.database.Roles import RolesDB
from app.database.Settings import SettingsDB
from app.database.EmployeeActivity import EmployeeActivityDB
from app.schemas.employee_attachments_schemas import (
    EmployeeAttachmentCreate,
    EmployeeAttachmentInDB,
    EmployeeAttachmentUpdate
)
from app.utils.permissions import check_permission
from app.database import get_database_instances

router = APIRouter(prefix="/hrms/employees", tags=["employee-attachments"])

async def get_employee_attachments_db():
    db_instances = get_database_instances()
    return db_instances["employee_attachments"]

async def get_users_db():
    db_instances = get_database_instances()
    return db_instances["users"]

async def get_roles_db():
    db_instances = get_database_instances()
    return db_instances["roles"]

async def get_settings_db():
    db_instances = get_database_instances()
    return db_instances["settings"]

async def get_employee_activity_db():
    db_instances = get_database_instances()
    return db_instances["employee_activity"]

@router.get("/{employee_id}/attachments", response_model=List[Dict[str, Any]])
async def get_employee_attachments(
    employee_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    employee_attachments_db: EmployeeAttachmentsDB = Depends(get_employee_attachments_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    settings_db: SettingsDB = Depends(get_settings_db)
):
    """Get all attachments for a specific employee"""
    try:
        # Skip permission check - REMOVED AUTHORIZATION
        
        attachments = await employee_attachments_db.get_employee_attachments(employee_id)
        
        # Get attachment types to map IDs to names
        attachment_types = await settings_db.get_attachment_types(is_active=True, target_type="employees")
        
        # Handle both 'id' and '_id' keys for compatibility
        type_map = {}
        for at in attachment_types:
            type_id = at.get('id') or at.get('_id')
            if type_id:
                type_map[str(type_id)] = at.get('name', 'Unknown Type')
        
        # Enhance attachments with type names and proper titles
        for attachment in attachments:
            # Set the attachment type name instead of ID
            attachment_type_id = attachment.get('attachment_type')
            attachment['attachment_type_name'] = type_map.get(attachment_type_id, attachment_type_id)
            
            # Set title as the original filename
            attachment['title'] = attachment.get('original_file_name', attachment.get('file_name', 'Unknown'))
            
        return attachments
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching employee attachments: {str(e)}"
        )

@router.post("/{employee_id}/attachments", response_model=Dict[str, str])
async def upload_employee_attachment(
    employee_id: str,
    file: UploadFile = File(...),
    attachment_type: str = Form(...),
    description: Optional[str] = Form(""),
    is_password_protected: Optional[bool] = Form(False),
    password: Optional[str] = Form(""),
    user_id: str = Query(..., description="ID of the user making the request"),
    employee_attachments_db: EmployeeAttachmentsDB = Depends(get_employee_attachments_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    settings_db: SettingsDB = Depends(get_settings_db),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db)
):
    """Upload an attachment for a specific employee"""
    print(f"🔥 DEBUG: Starting upload for employee_id={employee_id}, user_id={user_id}")
    print(f"🔥 DEBUG: File details - name={file.filename}, content_type={file.content_type}")
    print(f"🔥 DEBUG: Form data - attachment_type={attachment_type}, description={description}")
    
    try:
        # Skip permission check - REMOVED AUTHORIZATION
        print(f"🔥 DEBUG: Skipping permissions check")
        
        # Validate attachment type
        print(f"🔥 DEBUG: Fetching attachment types for validation")
        attachment_types = await settings_db.get_attachment_types(is_active=True, target_type="employees")
        print(f"🔥 DEBUG: Found {len(attachment_types)} attachment types")
        print(f"🔥 DEBUG: Sample attachment type structure: {attachment_types[0] if attachment_types else 'No types found'}")
        
        # Handle both 'id' and '_id' keys for compatibility
        valid_type_ids = []
        for at in attachment_types:
            type_id = at.get('id') or at.get('_id')
            if type_id:
                valid_type_ids.append(str(type_id))
        
        print(f"🔥 DEBUG: Valid type IDs: {valid_type_ids}")
        
        if attachment_type not in valid_type_ids:
            print(f"🔥 DEBUG: Invalid attachment type {attachment_type}, valid ones are {valid_type_ids}")
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid attachment type: {attachment_type}"
            )
        
        print(f"🔥 DEBUG: Attachment type validation passed")
        
        # Generate unique filename
        print(f"🔥 DEBUG: Generating unique filename")
        file_extension = os.path.splitext(file.filename)[1] if file.filename else ""
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        print(f"🔥 DEBUG: Generated filename: {unique_filename}")
        
        # Create media directory if it doesn't exist
        print(f"🔥 DEBUG: Creating media directory")
        media_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "media", "employees", employee_id)
        print(f"🔥 DEBUG: Media directory path: {media_dir}")
        os.makedirs(media_dir, exist_ok=True)
        print(f"🔥 DEBUG: Media directory created/exists")
        
        # Save file
        print(f"🔥 DEBUG: Saving file to disk")
        file_path = os.path.join(media_dir, unique_filename)
        print(f"🔥 DEBUG: Full file path: {file_path}")
        with open(file_path, "wb") as buffer:
            content = await file.read()
            print(f"🔥 DEBUG: File content size: {len(content)} bytes")
            buffer.write(content)
        print(f"🔥 DEBUG: File saved successfully")
        
        # Create attachment record
        print(f"🔥 DEBUG: Creating attachment record in database")
        attachment_data = {
            "employee_id": employee_id,
            "file_name": unique_filename,
            "original_file_name": file.filename,
            "file_path": file_path,
            "file_size": len(content),
            "file_type": file.content_type,
            "attachment_type": attachment_type,
            "description": description,
            "is_password_protected": is_password_protected,
            "password": password if is_password_protected else None,
            "uploaded_by": user_id,
            "created_at": get_ist_now(),
            "updated_at": get_ist_now()
        }
        print(f"🔥 DEBUG: Attachment data prepared: {attachment_data}")
        
        attachment_id = await employee_attachments_db.create_attachment(attachment_data)
        print(f"🔥 DEBUG: Attachment created with ID: {attachment_id}")
        
        # Log the attachment upload activity
        try:
            print(f"🔥 DEBUG: Logging attachment upload activity")
            activity_db.log_attachment_upload(
                employee_id=employee_id,
                uploaded_by=user_id,
                attachment_data={
                    "file_name": file.filename,
                    "original_file_name": file.filename,
                    "file_type": file.content_type,
                    "attachment_type": attachment_type,
                    "file_size": len(content),
                    "file_path": file_path,
                    "description": description
                }
            )
            print(f"🔥 DEBUG: Activity logged successfully")
        except Exception as activity_error:
            print(f"🔥 DEBUG: Warning - Failed to log activity: {activity_error}")
            # Don't fail the upload if activity logging fails
        
        print(f"🔥 DEBUG: Upload completed successfully")
        return {
            "message": "Attachment uploaded successfully",
            "attachment_id": attachment_id
        }
        
    except HTTPException as he:
        print(f"🔥 DEBUG: HTTP Exception occurred: {he.detail}")
        raise he
    except Exception as e:
        print(f"🔥 DEBUG: Unexpected error occurred: {str(e)}")
        print(f"🔥 DEBUG: Error type: {type(e).__name__}")
        print(f"🔥 DEBUG: Full traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading attachment: {str(e)}"
        )

@router.get("/{employee_id}/attachments/{attachment_id}/download")
async def download_employee_attachment(
    employee_id: str,
    attachment_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    password: Optional[str] = Query(None, description="Password for protected files"),
    employee_attachments_db: EmployeeAttachmentsDB = Depends(get_employee_attachments_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db)
):
    """Download an employee attachment"""
    print(f"📥 DEBUG: Download request - employee_id={employee_id}, attachment_id={attachment_id}, user_id={user_id}")
    
    try:
        # Skip permission check - REMOVED AUTHORIZATION
        print(f"📥 DEBUG: Skipping permissions check")
        
        # Get attachment
        print(f"📥 DEBUG: Getting attachment by ID: {attachment_id}")
        attachment = await employee_attachments_db.get_attachment_by_id(attachment_id)
        print(f"📥 DEBUG: Attachment found: {attachment is not None}")
        
        if not attachment:
            print(f"📥 DEBUG: Attachment not found in database")
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Attachment not found"
            )
        
        print(f"📥 DEBUG: Attachment details: {attachment}")
        
        # if attachment['employee_id'] != employee_id:
        #     print(f"📥 DEBUG: Employee ID mismatch - expected: {employee_id}, got: {attachment['employee_id']}")
        #     raise HTTPException(
        #         status_code=http_status.HTTP_403_FORBIDDEN,
        #         detail="Attachment does not belong to this employee"
        #     )
        
        # Check password protection
        # if attachment.get('is_password_protected') and attachment.get('password'):
        #     print(f"📥 DEBUG: File is password protected")
        #     if not password or password != attachment['password']:
        #         print(f"📥 DEBUG: Password check failed")
        #         raise HTTPException(
        #             status_code=http_status.HTTP_401_UNAUTHORIZED,
        #             detail="Password required for this file"
        #         )
        
        # Check if file exists
        file_path = attachment['file_path']
        print(f"📥 DEBUG: File path: {file_path}")
        print(f"📥 DEBUG: File exists: {os.path.exists(file_path) if file_path else False}")
        
        if not file_path or not os.path.exists(file_path):
            print(f"📥 DEBUG: File not found on disk at path: {file_path}")
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"File not found on disk: {file_path}"
            )
        
        # Determine content type
        content_type = attachment.get('file_type', 'application/octet-stream')
        if not content_type:
            content_type, _ = mimetypes.guess_type(file_path)
            content_type = content_type or 'application/octet-stream'
        
        # Force download for all files, including images
        # Override content type for images to prevent browser preview
        if content_type and content_type.startswith('image/'):
            print(f"📥 DEBUG: Image file detected, forcing download")
            content_type = 'application/octet-stream'
        
        print(f"📥 DEBUG: Content type: {content_type}")
        print(f"📥 DEBUG: Original filename: {attachment.get('original_file_name')}")
        
        # Stream file
        def file_generator():
            try:
                with open(file_path, "rb") as file:
                    while chunk := file.read(8192):
                        yield chunk
            except Exception as e:
                print(f"📥 DEBUG: Error reading file: {e}")
                raise e
        
        print(f"📥 DEBUG: Starting file stream")
        return StreamingResponse(
            file_generator(),
            media_type=content_type,
            headers={
                "Content-Disposition": f"attachment; filename=\"{attachment['original_file_name']}\"",
                "Content-Type": content_type,
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
        
    except HTTPException as he:
        print(f"📥 DEBUG: HTTP Exception: {he.detail}")
        raise he
    except Exception as e:
        print(f"📥 DEBUG: Unexpected error: {str(e)}")
        print(f"📥 DEBUG: Error type: {type(e).__name__}")
        print(f"📥 DEBUG: Full traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error downloading attachment: {str(e)}"
        )

@router.delete("/{employee_id}/attachments/{attachment_id}", response_model=Dict[str, str])
async def delete_employee_attachment(
    employee_id: str,
    attachment_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    employee_attachments_db: EmployeeAttachmentsDB = Depends(get_employee_attachments_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    activity_db: EmployeeActivityDB = Depends(get_employee_activity_db)
):
    """Delete an employee attachment"""
    print(f"🗑️ DEBUG: Delete request - employee_id={employee_id}, attachment_id={attachment_id}, user_id={user_id}")
    
    try:
        # Skip permission check - REMOVED AUTHORIZATION
        print(f"🗑️ DEBUG: Skipping permissions check")
        
        # Get attachment
        print(f"🗑️ DEBUG: Getting attachment by ID: {attachment_id}")
        attachment = await employee_attachments_db.get_attachment_by_id(attachment_id)
        print(f"🗑️ DEBUG: Attachment found: {attachment is not None}")
        
        if not attachment:
            print(f"🗑️ DEBUG: Attachment not found in database")
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Attachment not found"
            )
        
        print(f"🗑️ DEBUG: Attachment details: {attachment}")
        
        # Skip employee validation for flexibility - REMOVED VALIDATION
        print(f"🗑️ DEBUG: Skipping employee validation")
        
        # Delete file from disk
        file_path = attachment['file_path']
        print(f"🗑️ DEBUG: File path: {file_path}")
        print(f"🗑️ DEBUG: File exists: {os.path.exists(file_path) if file_path else False}")
        
        if os.path.exists(file_path):
            print(f"🗑️ DEBUG: Deleting file from disk")
            os.remove(file_path)
            print(f"🗑️ DEBUG: File deleted successfully")
        else:
            print(f"🗑️ DEBUG: File does not exist on disk, skipping file deletion")
        
        # Delete from database
        print(f"🗑️ DEBUG: Deleting attachment from database")
        await employee_attachments_db.delete_attachment(attachment_id)
        print(f"🗑️ DEBUG: Attachment deleted from database successfully")
        
        # Log the attachment deletion activity
        try:
            print(f"🗑️ DEBUG: Logging attachment deletion activity")
            activity_db.log_attachment_delete(
                employee_id=employee_id,
                deleted_by=user_id,
                attachment_data={
                    "file_name": attachment.get('original_file_name', attachment.get('file_name')),
                    "file_type": attachment.get('file_type'),
                    "attachment_type": attachment.get('attachment_type')
                }
            )
            print(f"🗑️ DEBUG: Deletion activity logged successfully")
        except Exception as activity_error:
            print(f"🗑️ DEBUG: Warning - Failed to log deletion activity: {activity_error}")
            # Don't fail the deletion if activity logging fails
        
        print(f"🗑️ DEBUG: Delete operation completed successfully")
        return {"message": "Attachment deleted successfully"}
        
    except HTTPException as he:
        print(f"🗑️ DEBUG: HTTP Exception: {he.detail}")
        raise he
    except Exception as e:
        print(f"🗑️ DEBUG: Unexpected error: {str(e)}")
        print(f"🗑️ DEBUG: Error type: {type(e).__name__}")
        print(f"🗑️ DEBUG: Full traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting attachment: {str(e)}"
        )

@router.put("/{employee_id}/attachments/{attachment_id}", response_model=Dict[str, str])
async def rename_employee_attachment(
    employee_id: str,
    attachment_id: str,
    body: dict,
    user_id: str = Query(..., description="ID of the user making the request"),
    employee_attachments_db: EmployeeAttachmentsDB = Depends(get_employee_attachments_db),
):
    """Rename an employee attachment (update original_file_name)"""
    try:
        new_name = (body.get("original_file_name") or "").strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="original_file_name is required")
        attachment = await employee_attachments_db.get_attachment_by_id(attachment_id)
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")
        await employee_attachments_db.update_attachment(attachment_id, {"original_file_name": new_name})
        return {"message": "Attachment renamed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error renaming attachment: {str(e)}")


@router.get("/{employee_id}/attachments/bulk-download")
async def bulk_download_employee_attachments(
    employee_id: str,
    user_id: str = Query(..., description="ID of the user making the request"),
    employee_attachments_db: EmployeeAttachmentsDB = Depends(get_employee_attachments_db),
    users_db: UsersDB = Depends(get_users_db),
    roles_db: RolesDB = Depends(get_roles_db),
    settings_db: SettingsDB = Depends(get_settings_db)
):
    """Download all employee attachments as a ZIP file"""
    print(f"🔽 DEBUG: Starting bulk download for employee {employee_id}")
    
    try:
        # Skip permission check - REMOVED AUTHORIZATION
        print(f"🔽 DEBUG: Skipping permissions check")
        
        # Get all attachments for this employee
        attachments = await employee_attachments_db.get_employee_attachments(employee_id)
        print(f"🔽 DEBUG: Found {len(attachments)} attachments")
        
        if not attachments:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="No attachments found for this employee"
            )
        
        # Get attachment types for naming
        attachment_types = await settings_db.get_attachment_types(is_active=True, target_type="employees")
        type_map = {}
        for at in attachment_types:
            type_id = at.get('id') or at.get('_id')
            if type_id:
                type_map[str(type_id)] = at.get('name', 'Unknown Type')
        
        print(f"🔽 DEBUG: Type map: {type_map}")
        
        # Create a temporary zip file
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        print(f"🔽 DEBUG: Created temp zip file: {temp_zip.name}")
        
        try:
            with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zipf:
                passwords_content = "Employee Attachments - Password Information\n"
                passwords_content += "=" * 50 + "\n\n"
                
                files_added = 0
                files_missing = 0
                
                for attachment in attachments:
                    file_path = attachment.get('file_path')
                    original_name = attachment.get('original_file_name', attachment.get('file_name', 'unknown'))
                    attachment_type_name = type_map.get(attachment.get('attachment_type', ''), 'Unknown')
                    zip_filename = f"{attachment_type_name}_{original_name}"
                    
                    print(f"🔽 DEBUG: Processing file: {original_name}")
                    print(f"🔽 DEBUG: File path: {file_path}")
                    print(f"🔽 DEBUG: File exists: {os.path.exists(file_path) if file_path else False}")
                    
                    # Check if file exists
                    if file_path and os.path.exists(file_path):
                        try:
                            # Add file to zip with proper name
                            zipf.write(file_path, zip_filename)
                            files_added += 1
                            print(f"🔽 DEBUG: Successfully added file to zip: {zip_filename}")
                            
                            # Add password info
                            if attachment.get('is_password_protected') and attachment.get('password'):
                                passwords_content += f"File: {zip_filename}\n"
                                passwords_content += f"Password: {attachment.get('password')}\n"
                                passwords_content += f"Description: {attachment.get('description', 'No description')}\n"
                                passwords_content += "-" * 30 + "\n\n"
                            else:
                                passwords_content += f"File: {zip_filename}\n"
                                passwords_content += f"Password: No password required\n"
                                passwords_content += f"Description: {attachment.get('description', 'No description')}\n"
                                passwords_content += "-" * 30 + "\n\n"
                        except Exception as e:
                            print(f"🔽 DEBUG: Error adding file to zip: {e}")
                            passwords_content += f"File: {zip_filename}\n"
                            passwords_content += f"Status: Error adding to zip - {str(e)}\n"
                            passwords_content += "-" * 30 + "\n\n"
                    else:
                        files_missing += 1
                        print(f"🔽 DEBUG: File missing: {file_path}")
                        passwords_content += f"File: {zip_filename}\n"
                        passwords_content += f"Status: File not found on disk\n"
                        passwords_content += f"Expected path: {file_path}\n"
                        passwords_content += "-" * 30 + "\n\n"
                
                print(f"🔽 DEBUG: Files added to zip: {files_added}, Files missing: {files_missing}")
                
                # Add passwords file to zip
                zipf.writestr("PASSWORDS.txt", passwords_content)
            
            print(f"🔽 DEBUG: Zip file created successfully")
            
            # Stream the zip file
            def file_generator():
                with open(temp_zip.name, "rb") as file:
                    while chunk := file.read(8192):
                        yield chunk
                # Clean up temp file after streaming
                os.unlink(temp_zip.name)
            
            return StreamingResponse(
                file_generator(),
                media_type="application/zip",
                headers={
                    "Content-Disposition": f"attachment; filename=\"employee_{employee_id}_attachments.zip\""
                }
            )
            
        except Exception as e:
            print(f"🔽 DEBUG: Error creating zip: {e}")
            # Clean up temp file on error
            if os.path.exists(temp_zip.name):
                os.unlink(temp_zip.name)
            raise e
            
    except Exception as e:
        print(f"🔽 DEBUG: Bulk download error: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating bulk download: {str(e)}"
        )