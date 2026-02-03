"""
Lead Excel Export Module
Exports all leads with complete data to Excel format
"""

from fastapi import APIRouter, HTTPException, Response
from app.database.Leads import LeadsDB
from typing import Dict, Any, List
import pandas as pd
from datetime import datetime
from io import BytesIO
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class LeadExcelExporter:
    """Handles exporting leads data to Excel format"""
    
    def __init__(self):
        self.leads_db = LeadsDB()
    
    def flatten_dict(self, data: Dict[str, Any], parent_key: str = '', sep: str = '.') -> Dict[str, Any]:
        """
        Flatten a nested dictionary into a single-level dictionary with dot notation keys
        
        Args:
            data: Dictionary to flatten
            parent_key: Parent key for nested structures
            sep: Separator between keys
            
        Returns:
            Flattened dictionary
        """
        items = []
        
        for key, value in data.items():
            # Skip internal MongoDB fields
            if key in ['_id', 'created_by', 'updated_at', 'updated_by']:
                continue
            
            # Build the new key
            new_key = f"{parent_key}{sep}{key}" if parent_key else key
            
            # Handle different data types
            if isinstance(value, dict):
                # Recursively flatten dictionaries
                items.extend(self.flatten_dict(value, new_key, sep=sep).items())
            elif isinstance(value, list):
                # Handle arrays - convert to string representation
                if value:
                    if all(isinstance(item, dict) for item in value):
                        # Array of objects - convert to JSON string
                        items.append((new_key, json.dumps(value, default=str, indent=2)))
                    else:
                        # Array of simple values - join with comma
                        items.append((new_key, ', '.join(str(v) for v in value)))
                else:
                    items.append((new_key, ''))
            elif isinstance(value, datetime):
                # Format datetime
                items.append((new_key, value.strftime('%Y-%m-%d %H:%M:%S')))
            elif value is None:
                # Convert None to empty string
                items.append((new_key, ''))
            else:
                items.append((new_key, str(value)))
        
        return dict(items)
    
    def format_column_name(self, key: str) -> str:
        """
        Convert database field names to human-readable column names
        
        Args:
            key: Database field key (e.g., 'first_name', 'dynamic_fields.personal_details.email')
            
        Returns:
            Human-readable column name
        """
        # Remove 'dynamic_fields.' prefix
        if key.startswith('dynamic_fields.'):
            key = key.replace('dynamic_fields.', '')
        
        # Handle process_data prefix
        if key.startswith('process_data.'):
            key = key.replace('process_data.', 'How To Process - ')
        
        # Replace underscores with spaces and capitalize
        name = key.replace('_', ' ').title()
        
        # Handle nested structures
        if '.' in name:
            parts = name.split('.')
            formatted_parts = []
            for i, part in enumerate(parts):
                if i == 0:
                    # First part is the section name
                    formatted_parts.append(part.title())
                else:
                    # Subsequent parts are field names
                    formatted_parts.append(part.title())
            name = ' - '.join(formatted_parts)
        
        # Special mappings for better readability
        special_mappings = {
            'Custom Lead Id': 'Lead ID',
            'First Name': 'First Name',
            'Last Name': 'Last Name',
            'Phone': 'Phone Number',
            'Alternative Phone': 'Alternate Phone',
            'Assign Report To': 'Reported To',
            'Loan Type': 'Loan Type',
            'Loan Type Name': 'Loan Type Name',
            'Loan Amount': 'Loan Amount',
            'Data Code': 'Data Code',
            'Campaign Name': 'Campaign Name',
            'Pincode City': 'Pincode City',
            'Importantquestion': 'Important Questions',
            'Question Responses': 'Important Questions Responses',
            'Important Questions Validated': 'Questions Validated',
            'File Sent To Login': 'File Sent to Login',
            'Login Department Sent Date': 'Login Department Date',
            'Form Share': 'Form Shareable',
            'Reference': 'Reference',
            'Whatsapp Number': 'WhatsApp Number',
            'Source': 'Source',
            'Priority': 'Priority',
            'Status': 'Status',
            'Sub Status': 'Sub Status',
            'Department Id': 'Department ID',
            'Department Name': 'Department Name',
            'Created By': 'Created By',
            'Created By Name': 'Created By Name',
            'Created At': 'Created Date',
            'Personal Details': 'Personal Information',
            'Employment Details': 'Employment Information',
            'Residence Details': 'Residence Information',
            'Business Details': 'Business Information',
            'Coapplicant Personal Details': 'Co-Applicant Personal Info',
            'Coapplicant Employment Details': 'Co-Applicant Employment Info',
            'Coapplicant Residence Details': 'Co-Applicant Residence Info',
            'Coapplicant Business Details': 'Co-Applicant Business Info',
            'Financial Details': 'Financial Information',
            'Eligibility Details': 'Eligibility Information',
            'Identity Details': 'Identity Information',
            'Obligation Data': 'Obligations',
            'Check Eligibility': 'Eligibility Check',
            'Login Form': 'Login Form Data',
            'Cibil Score': 'CIBIL Score',
            'Loan Eligibility': 'Loan Eligibility',
            'Company Name': 'Company Name',
            'Company Category': 'Company Category',
            'Salary': 'Salary',
            'Customer Name': 'Customer Name (Login)',
            'Obligations': 'Obligations List',
            'Process': 'Process Details',
            'Foir Percent': 'FOIR Percentage',
            'Custom Foir Percent': 'Custom FOIR Percentage',
            'Monthly Emi Can Pay': 'Monthly EMI Can Pay',
            'Tenure Months': 'Tenure (Months)',
            'Tenure Years': 'Tenure (Years)',
            'Roi': 'Rate of Interest',
            'Foir Eligibility': 'FOIR Eligibility',
            'Multiplier': 'Multiplier',
        }
        
        return special_mappings.get(name, name)
    
    def process_lead_for_excel(self, lead: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a single lead record for Excel export
        
        Args:
            lead: Lead document from MongoDB
            
        Returns:
            Processed lead dictionary ready for Excel
        """
        # Convert MongoDB ObjectId to string if present
        if '_id' in lead:
            lead['_id'] = str(lead['_id'])
        
        # Merge First Name and Last Name into Customer Name
        first_name = lead.get('first_name', '')
        last_name = lead.get('last_name', '')
        lead['Customer Name'] = f"{first_name} {last_name}".strip()
        
        # Flatten the entire lead structure
        flattened = self.flatten_dict(lead)
        
        # Reorder to put Customer Name first
        if 'Customer Name' in flattened:
            customer_name = flattened.pop('Customer Name')
            flattened = {'Customer Name': customer_name, **flattened}
        
        # Remove original first_name and last_name from flattened
        flattened.pop('First Name', None)
        flattened.pop('Last Name', None)
        
        return flattened
    
    async def export_all_leads_to_excel(self) -> bytes:
        """
        Export all leads to Excel format
        
        Returns:
            Excel file content as bytes
        """
        try:
            logger.info("Starting Excel export for all leads...")
            
            # Fetch all leads (no filter, no limit)
            all_leads = await self.leads_db.list_leads(
                filter_dict={},
                skip=0,
                limit=0,  # 0 means no limit
                sort_by="created_at",
                sort_order=-1
            )
            
            logger.info(f"Found {len(all_leads)} leads to export")
            
            if not all_leads:
                logger.warning("No leads found to export")
                raise HTTPException(status_code=404, detail="No leads found")
            
            # Process all leads
            processed_leads = []
            for lead in all_leads:
                try:
                    processed = self.process_lead_for_excel(lead)
                    processed_leads.append(processed)
                except Exception as e:
                    logger.error(f"Error processing lead {lead.get('_id')}: {e}")
                    continue
            
            logger.info(f"Successfully processed {len(processed_leads)} leads")
            
            # Create DataFrame
            df = pd.DataFrame(processed_leads)
            
            # Format column names
            df.columns = [self.format_column_name(col) for col in df.columns]
            
            # Create Excel writer
            output = BytesIO()
            
            # Write to Excel with formatting
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                # Write the main data
                df.to_excel(writer, sheet_name='All Leads', index=False)
                
                # Get the worksheet
                worksheet = writer.sheets['All Leads']
                
                # Auto-adjust column widths
                for column in worksheet.columns:
                    max_length = 0
                    column_letter = column[0].column_letter
                    
                    for cell in column:
                        try:
                            if len(str(cell.value)) > max_length:
                                max_length = len(str(cell.value))
                        except:
                            pass
                    
                    # Set width with some padding
                    adjusted_width = min(max_length + 2, 50)
                    worksheet.column_dimensions[column_letter].width = adjusted_width
                
                # Format header row
                for cell in worksheet[1]:
                    cell.font = {'bold': True, 'color': 'FFFFFF'}
                    cell.fill = {'fill_type': 'solid', 'start_color': '4472C4'}
                    cell.alignment = {'horizontal': 'center'}
                
                # Freeze header row
                worksheet.freeze_panes = 'A2'
            
            # Get the Excel content
            output.seek(0)
            excel_content = output.getvalue()
            
            logger.info(f"Excel export completed. File size: {len(excel_content)} bytes")
            
            return excel_content
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error during Excel export: {e}")
            raise HTTPException(status_code=500, detail=f"Error exporting leads to Excel: {str(e)}")


# Initialize exporter
excel_exporter = LeadExcelExporter()


@router.get("/export-leads")
async def export_leads_to_excel():
    """
    Export all leads to Excel file
    
    Returns:
        Excel file download with all lead data
    """
    try:
        # Generate Excel file
        excel_content = await excel_exporter.export_all_leads_to_excel()
        
        # Create filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"Leads_Export_{timestamp}.xlsx"
        
        # Return file as download
        return Response(
            content=excel_content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in export endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")