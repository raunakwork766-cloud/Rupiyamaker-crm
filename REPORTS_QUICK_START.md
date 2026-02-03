# Reports Module - Quick Start Guide

## Installation

### 1. Install Required Packages
```bash
npm install xlsx dayjs
```

### 2. Add Component to Routes
In your `rupiyamaker-UI/crm/src/App.js` or `routes.js`:

```javascript
import ComprehensiveReportDark from './components/reports/ComprehensiveReportDark';

// Add to routes:
<Route path="/reports" element={<ComprehensiveReportDark />} />
```

### 3. Add to Sidebar Menu
In your `Layout.js` or `Sidebar.js`:

```javascript
<Menu.Item key="/reports" icon={<FileTextOutlined />}>
    Reports
</Menu.Item>
```

## Quick Usage

### 1. View Reports
- Click "Reports" from sidebar
- See all 7 report categories in dropdown
- Default view: PLOD Leads

### 2. Switch Categories
- Click the dropdown button (top right)
- Select: PLOD Leads, Login Leads, Tasks, Tickets, Attendance, Employees, or Leaves

### 3. Filter Data
- **Date Range**: Select start and end dates
- **Status**: Filter by Active, Pending, Completed, etc.
- **Search**: Type to search across all fields
- **Reset**: Click "Reset Filters" to clear all

### 4. View Lead Details
- Click any lead row
- Modal opens with 6 tabs:
  - About (Basic info)
  - Obligations (EMI details)
  - Remarks (All remark types)
  - Tasks (Associated tasks)
  - Attachments (Documents)
  - Activity History (Complete timeline)

### 5. Export Data
Three export options:

**Option A: Single Row Export**
- Click download icon on any row
- Exports complete lead details with 6 Excel sheets
- Filename: `leads_LEADID_2026-02-02.xlsx`

**Option B: Bulk Export**
- Select multiple rows using checkboxes
- Click "Export (X)" button
- Fetches complete details for all selected leads

**Option C: Export All**
- Click "Export All" button
- Exports all currently filtered data
- Quick export without fetching details

## Key Features

### ✅ Dark Theme
- Professional black/dark gray background
- High contrast text for readability
- Gradient accent colors
- Glass-morphism cards

### ✅ Category-Wise Reports
- PLOD Leads (Regular leads)
- Login Leads (Only leads sent to login)
- Tasks, Tickets, Attendance, Employees, Leaves

### ✅ Login Leads Fix
- **Fixed**: Login dropdown now shows ONLY login leads
- Uses: `file_sent_to_login: true` parameter
- PLOD Leads shows only regular leads

### ✅ Lead Detail Modal
- Click any row to view complete details
- 6 organized tabs
- All related data in one place

### ✅ Excel Export
- Multiple sheets for complete data
- No field truncation
- All tabs exported separately

## Troubleshooting

### "Login leads not showing"
✅ **Fix**: Backend must support `file_sent_to_login` query parameter

### "User names showing as Unknown"
✅ **Fix**: Check `hrmsService.getAllEmployees()` returns valid data

### "Export not working"
✅ **Fix**: Ensure `xlsx` package is installed

### "Dark theme not applying"
✅ **Fix**: Check for CSS overrides in global styles

## File Locations

```
rupiyamaker-UI/crm/src/
├── components/
│   └── reports/
│       └── ComprehensiveReportDark.jsx  ← Main component
└── services/
    ├── leadsService.js  ← Lead API calls
    └── hrmsService.js   ← Employee API calls
```

## API Requirements

The following backend endpoints must be available:

1. `GET /api/leads` - With `file_sent_to_login` query param support
2. `GET /api/leads/{id}` - Individual lead details
3. `GET /api/tasks` - Tasks data
4. `GET /api/tickets` - Tickets data
5. `GET /api/attendance` - Attendance data
6. `GET /api/leaves` - Leaves data
7. `GET /api/employees` - HRMS employees endpoint

## Customization Examples

### Change Accent Color
```javascript
// In ComprehensiveReportDark.jsx, find and replace:
background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
// With your preferred colors, e.g.:
background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
```

### Add New Report Section
```javascript
// Add to REPORT_SECTIONS array:
const REPORT_SECTIONS = [
    // ... existing
    { key: 'warnings', label: 'Warnings', icon: <WarningOutlined /> },
];

// Add case in fetchData:
case 'warnings':
    const warningsResponse = await axios.get(`${API_BASE_URL}/api/warnings`, {...});
    fetchedData = warningsResponse.data.data || [];
    break;
```

### Modify Excel Export Fields
```javascript
// In exportSingleToExcel, modify the aboutData array:
const aboutData = [{
    'Lead ID': lead.custom_lead_id || null,
    'Custom Field': lead.your_custom_field || null,  // Add your field
    // ... other fields
}];
```

## Performance Tips

1. **User Caching**: Users are fetched once at startup
2. **Lazy Loading**: Data fetched only when section is selected
3. **Client-side Filtering**: Instant filter results
4. **Optimized Pagination**: Default 50 rows per page
5. **Efficient Exports**: Direct table export for "Export All"

## Support & Documentation

- **Full Documentation**: See `DARK_THEME_REPORTS_IMPLEMENTATION.md`
- **Component Source**: `rupiyamaker-UI/crm/src/components/reports/ComprehensiveReportDark.jsx`
- **Issue Reporting**: Check browser console for errors

## Version Info

- **Version**: 1.0.0
- **Last Updated**: February 2, 2026
- **Framework**: React 18.x + Ant Design 4.x
- **Dependencies**: xlsx, dayjs, axios

---

**Ready to Use!** The Reports module is now fully functional with all requested features.