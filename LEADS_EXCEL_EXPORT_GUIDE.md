# Leads Excel Export - Complete Documentation

## Overview

This document provides comprehensive information about the Lead Excel Export feature, which allows you to export all leads from your CRM system to a single Excel (.xlsx) file containing complete data from all tabs and sections.

## Quick Start

### Export All Leads

**API Endpoint:** `GET /leads/excel-export/export-leads`

**Example using curl:**
```bash
curl -X GET "http://your-domain:8049/leads/excel-export/export-leads" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o leads_export_20260203.xlsx
```

**Example using JavaScript:**
```javascript
fetch('http://your-domain:8049/leads/excel-export/export-leads', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
})
.then(response => response.blob())
.then(blob => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leads_export.xlsx';
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
});
```

## Features

### ✅ Complete Data Export
- **All Leads**: Exports every lead in the system (no filters, no limits)
- **All Fields**: Includes every field from all tabs and sections
- **No Data Skipped**: Even hidden/conditional fields are exported
- **Empty Fields**: Empty fields remain blank in the Excel file

### ✅ Data Transformation
- **Merged Names**: First Name + Last Name = Customer Name (first column)
- **Flattened Structure**: Nested objects converted to readable columns
- **Human-Readable Names**: Database fields converted to readable column names
- **Dropdown Values**: Selected text/value exported, not IDs
- **Formatted Dates**: Datetimes formatted as YYYY-MM-DD HH:MM:SS

### ✅ Excel Formatting
- **Auto-Sized Columns**: Column widths adjusted to content
- **Header Styling**: Bold, blue header row
- **Frozen Header**: Header row stays visible while scrolling
- **Single Sheet**: All data in one "All Leads" sheet

## Data Structure & Mapping

### Column Organization

The Excel file organizes data in the following structure:

1. **Customer Name** (First column - merged first_name + last_name)
2. **Basic Lead Information** (Lead ID, Phone, Loan Type, etc.)
3. **Personal Information** (Name, Contact, Address, etc.)
4. **Employment Information** (Company, Salary, etc.)
5. **Residence Information** (Address, Pincode, City, etc.)
6. **Business Information** (Business details)
7. **Co-Applicant Information** (Personal, Employment, Residence, Business)
8. **Financial Information** (Income, Assets, etc.)
9. **Eligibility Information** (CIBIL score, eligibility check)
10. **Obligations** (All obligation-related data)
11. **How To Process** (Process data and calculations)
12. **Login Form Data** (Login form fields)
13. **Important Questions** (Question responses)
14. **Custom Fields** (Any dynamic/custom fields)
15. **System Fields** (Created date, Status, etc.)

### Field Name Mappings

The system automatically converts database field names to human-readable column names:

| Database Field | Excel Column Name |
|---------------|-------------------|
| `first_name` + `last_name` | **Customer Name** |
| `custom_lead_id` | Lead ID |
| `phone` | Phone Number |
| `alternative_phone` | Alternate Phone |
| `loan_type` | Loan Type |
| `loan_amount` | Loan Amount |
| `priority` | Priority |
| `status` | Status |
| `sub_status` | Sub Status |
| `created_at` | Created Date |
| `dynamic_fields.personal_details.email` | Personal Information - Email |
| `dynamic_fields.employment_details.salary` | Employment Information - Salary |
| `process_data.cibil_score` | How To Process - CIBIL Score |
| `obligation_data` | Obligations |
| `login_form.customer_name` | Customer Name (Login) |

### Nested Data Flattening

Nested objects are flattened using dot notation and section names:

**Database Structure:**
```json
{
  "dynamic_fields": {
    "personal_details": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com"
    }
  }
}
```

**Excel Columns:**
- Personal Information - First Name: John
- Personal Information - Last Name: Doe
- Personal Information - Email: john@example.com

## Technical Implementation

### Backend Architecture

**File:** `backend/app/routes/leads_excel_export.py`

**Key Components:**

1. **LeadExcelExporter Class**
   - Main class handling Excel generation
   - Methods for data processing and flattening

2. **flatten_dict() Method**
   - Recursively flattens nested dictionaries
   - Handles arrays, dates, null values
   - Skips internal MongoDB fields (_id, created_by, etc.)

3. **format_column_name() Method**
   - Converts database field names to readable format
   - Applies special mappings for common fields
   - Formats nested structures with section names

4. **process_lead_for_excel() Method**
   - Processes individual lead records
   - Merges first and last name
   - Reorders columns (Customer Name first)

5. **export_all_leads_to_excel() Method**
   - Fetches all leads from database
   - Processes each lead
   - Generates Excel file with formatting

### Technology Stack

- **Backend Framework**: FastAPI (Python)
- **Database**: MongoDB with async Motor
- **Excel Library**: openpyxl + pandas
- **File Format**: .xlsx (Excel 2007+)

### Data Processing Flow

```
1. Fetch all leads from MongoDB
   ↓
2. For each lead:
   - Convert ObjectId to string
   - Merge first_name + last_name = Customer Name
   - Flatten nested dictionaries
   - Format column names
   - Handle special data types (dates, arrays, nulls)
   ↓
3. Create pandas DataFrame
   ↓
4. Format Excel:
   - Write data to sheet
   - Auto-size columns
   - Apply header styling
   - Freeze header row
   ↓
5. Return Excel file as download
```

## Data Handling

### Data Types

| Data Type | Handling |
|-----------|----------|
| **String** | Exported as-is |
| **Number** | Exported as-is |
| **Boolean** | Converted to string "True"/"False" |
| **DateTime** | Formatted as YYYY-MM-DD HH:MM:SS |
| **Array (Simple)** | Joined with comma separator |
| **Array (Objects)** | Converted to JSON string |
| **Object** | Flattened to multiple columns |
| **Null/None** | Exported as empty cell |

### Special Cases

1. **Dropdown Fields**
   - Exports the selected value/text
   - Not the dropdown ID or index

2. **Multi-select Fields**
   - Values joined with comma separator
   - Example: "Option A, Option B, Option C"

3. **Conditional Fields**
   - All fields exported, even if hidden
   - Empty values shown as blank cells

4. **Custom Dynamic Fields**
   - Automatically included in export
   - Field names formatted for readability

5. **Large Text Fields**
   - Exported as-is
   - Column auto-sized (max 50 characters width)

## Performance Considerations

### Large Datasets

The export is optimized for performance:

- **Async Database Operations**: Uses async Motor for non-blocking queries
- **Memory Efficient**: Processes leads in batches
- **No Pagination Limit**: Exports all leads regardless of count

### Expected Performance

| Leads Count | Export Time | File Size (approx) |
|-------------|-------------|-------------------|
| 1,000 | 5-10 seconds | 500 KB - 1 MB |
| 5,000 | 20-30 seconds | 2-5 MB |
| 10,000 | 40-60 seconds | 5-10 MB |
| 50,000 | 3-5 minutes | 25-50 MB |

### Optimization Tips

For very large datasets (>100K leads):

1. **Export During Low Traffic**: Schedule exports during off-peak hours
2. **Consider Filtering**: Add date range or status filters if needed
3. **Monitor Memory**: Ensure sufficient server memory (2GB+ recommended)
4. **Database Indexes**: Ensure indexes exist on queried fields

## Error Handling

### Common Errors

1. **No Leads Found**
   - Error: "No leads found"
   - Solution: Verify leads exist in database

2. **Database Connection Error**
   - Error: "Error exporting leads to Excel"
   - Solution: Check MongoDB connection

3. **Memory Error**
   - Error: 500 Internal Server Error
   - Solution: Increase server memory or filter leads

4. **Permission Error**
   - Error: 401/403 Unauthorized
   - Solution: Ensure proper authentication

### Logging

Export operations are logged in `backend.log`:

```
2026-02-03 12:00:00 - INFO - Starting Excel export for all leads...
2026-02-03 12:00:05 - INFO - Found 1234 leads to export
2026-02-03 12:00:10 - INFO - Successfully processed 1234 leads
2026-02-03 12:00:10 - INFO - Excel export completed. File size: 1234567 bytes
```

## Customization

### Adding Custom Field Mappings

Edit `format_column_name()` method in `leads_excel_export.py`:

```python
def format_column_name(self, key: str) -> str:
    # ... existing code ...
    
    # Add your custom mapping
    special_mappings = {
        # ... existing mappings ...
        'your_custom_field': 'Your Custom Field Name',
    }
    
    return special_mappings.get(name, name)
```

### Modifying Excel Styling

Edit the Excel writer section in `export_all_leads_to_excel()`:

```python
# Change header color
cell.fill = {'fill_type': 'solid', 'start_color': 'FF0000'}  # Red

# Change column width limit
adjusted_width = min(max_length + 5, 100)  # Increase max width
```

### Adding Filters

Modify the API endpoint to accept query parameters:

```python
@router.get("/export-leads")
async def export_leads_to_excel(
    start_date: str = None,
    end_date: str = None,
    status: str = None
):
    # Build filter based on parameters
    filter_dict = {}
    if start_date and end_date:
        filter_dict['created_at'] = {
            '$gte': start_date,
            '$lte': end_date
        }
    if status:
        filter_dict['status'] = status
```

## Frontend Integration

### React Component Example

```jsx
import React from 'react';
import { Button } from '@mui/material';

const LeadExcelExport = () => {
  const handleExport = async () => {
    try {
      const response = await fetch('/leads/excel-export/export-leads', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      a.download = `leads_export_${timestamp}.xlsx`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export leads');
    }
  };
  
  return (
    <Button 
      variant="contained" 
      color="primary"
      onClick={handleExport}
      startIcon={<DownloadIcon />}
    >
      Export All Leads to Excel
    </Button>
  );
};

export default LeadExcelExport;
```

## Security Considerations

### Authentication
- The endpoint requires valid authentication (JWT token)
- Ensure only authorized users can access the export

### Data Privacy
- All lead data is exported including sensitive information
- Ensure downloaded files are stored securely
- Consider implementing data masking for sensitive fields if needed

### Rate Limiting
- Consider adding rate limiting to prevent abuse
- Example: 1 export per 5 minutes per user

## Troubleshooting

### Export Fails to Start
- Check backend logs: `tail -f backend/backend.log`
- Verify MongoDB is running: `systemctl status mongodb`
- Check server memory: `free -h`

### Excel File Corrupted
- Verify openpyxl is installed: `pip list | grep openpyxl`
- Check disk space: `df -h`
- Try exporting smaller dataset first

### Missing Columns
- Verify lead data structure in MongoDB
- Check field name mappings in `format_column_name()`
- Review `flatten_dict()` for data type handling

### Slow Export Performance
- Check MongoDB query performance
- Add indexes on frequently queried fields
- Consider exporting during low traffic hours

## Maintenance

### Regular Tasks

1. **Monitor Export Logs**
   ```bash
   grep "Excel export" backend/backend.log
   ```

2. **Check File Sizes**
   - Monitor typical export file sizes
   - Set up alerts for unusually large exports

3. **Database Indexes**
   - Ensure indexes exist on common query fields
   - Monitor index usage with MongoDB profiler

4. **Server Resources**
   - Monitor CPU and memory during exports
   - Scale resources if needed

## Support & Updates

For issues or feature requests:

1. Check logs: `backend/backend.log`
2. Review this documentation
3. Verify data structure in MongoDB
4. Test with smaller dataset first

## Version History

- **v1.0** (2026-02-03): Initial release
  - Complete lead data export
  - Flattened nested structures
  - Merged customer names
  - Excel formatting with styling

---

**Last Updated:** February 3, 2026
**Backend File:** `backend/app/routes/leads_excel_export.py`
**API Endpoint:** `/leads/excel-export/export-leads`