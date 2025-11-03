# CustomStatusDropdown Component

A reusable React component that provides status and sub-status dropdown functionality with the same UI design as the existing HTML templates but with full working functionality.

## Features

- **Department-based status loading**: Automatically loads statuses based on the selected department (leads, login, sales, loan_processing)
- **Search functionality**: Built-in search for both status and sub-status dropdowns
- **Hierarchical selection**: Sub-statuses are filtered based on the selected main status
- **Consistent UI**: Maintains the exact same design as existing HTML templates
- **Accessibility**: Proper keyboard navigation and focus management
- **Click outside to close**: Dropdowns close when clicking outside
- **Loading states**: Shows loading indicators while fetching data
- **Error handling**: Graceful handling of API errors

## Usage

```jsx
import CustomStatusDropdown from './components/CustomStatusDropdown';

function MyComponent() {
    const [status, setStatus] = useState('');
    const [subStatus, setSubStatus] = useState('');

    return (
        <CustomStatusDropdown
            department="leads"              // 'leads', 'login', 'sales', 'loan_processing'
            selectedStatus={status}
            selectedSubStatus={subStatus}
            onStatusChange={setStatus}
            onSubStatusChange={setSubStatus}
            disabled={false}               // Optional: disable the dropdowns
            className="my-custom-class"    // Optional: additional CSS classes
        />
    );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `department` | string | 'leads' | The department to load statuses for |
| `selectedStatus` | string | '' | Currently selected status value |
| `selectedSubStatus` | string | '' | Currently selected sub-status value |
| `onStatusChange` | function | - | Callback when status is changed |
| `onSubStatusChange` | function | - | Callback when sub-status is changed |
| `disabled` | boolean | false | Whether the dropdowns are disabled |
| `className` | string | '' | Additional CSS classes |

## API Integration

The component automatically connects to the backend API endpoints:

- `GET /leads/admin/statuses?user_id={userId}&department={department}` - Loads statuses for the department

The component expects the following data structure from the API:

```json
[
  {
    "_id": "status_id",
    "name": "ACTIVE LEAD",
    "department": "leads",
    "order": 2,
    "color": "#3B82F6",
    "sub_statuses": [
      "NEW LEAD",
      "IN PROGRESS",
      "CALLBACK",
      "LONG FOLLOW-UP"
    ]
  }
]
```

## Styling

The component uses the same CSS classes as the existing templates:

- `status-dropdown` - Main dropdown container
- Tailwind CSS classes for styling
- Consistent with existing gray/white theme
- Proper focus states and hover effects

## Example

See `StatusDropdownExample.jsx` for a complete working example that demonstrates:

- Department selection
- Status and sub-status handling
- Current selection display
- Integration with other form elements

## Dependencies

- React (hooks: useState, useEffect, useRef)
- lucide-react (ChevronDown, ChevronUp icons)
- axios (for API calls)
- Tailwind CSS (for styling)

## Notes

- The component automatically resets sub-status when the main status changes
- User ID is retrieved from localStorage (checks both 'user_id' and 'userId')
- Dropdowns close automatically when clicking outside
- Search is case-insensitive
- Color indicators show next to status names if available
