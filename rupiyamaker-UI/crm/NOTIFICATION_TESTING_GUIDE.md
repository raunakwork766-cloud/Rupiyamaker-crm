# How to Test the New Notification System

## Quick Start Testing

Since your development server is already running, follow these steps to test the enhanced notification system:

### 1. Open Browser Console
- Open your browser's developer tools (F12)
- Go to the Console tab

### 2. Load Test Data
Run this command in the console:
```javascript
// Create test notifications
const testNotifications = [
  {
    _id: 'test-001',
    title: 'High Priority Task Overdue',
    message: 'The quarterly report submission is now 2 days overdue. Please complete immediately.',
    type: 'task_overdue',
    priority: 'high',
    read: false,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    user_id: '6852a2978d7cdc3a71c482a6'
  },
  {
    _id: 'test-002',
    title: 'New Lead Assignment',
    message: 'You have been assigned a new lead: John Smith from Acme Corp.',
    type: 'lead',
    priority: 'medium',
    read: false,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    user_id: '6852a2978d7cdc3a71c482a6'
  },
  {
    _id: 'test-003',
    title: 'System Maintenance Notice',
    message: 'Scheduled maintenance will occur tonight from 11 PM to 1 AM.',
    type: 'system',
    priority: 'low',
    read: true,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    user_id: '6852a2978d7cdc3a71c482a6'
  },
  {
    _id: 'test-004',
    title: 'Warning: Multiple Login Attempts',
    message: 'Multiple failed login attempts detected from your account.',
    type: 'warning',
    priority: 'high',
    read: false,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    user_id: '6852a2978d7cdc3a71c482a6'
  },
  {
    _id: 'test-005',
    title: 'Success: Document Approved',
    message: 'Your loan application document has been approved.',
    type: 'success',
    priority: 'normal',
    read: false,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    user_id: '6852a2978d7cdc3a71c482a6'
  }
];

localStorage.setItem('test_notifications', JSON.stringify(testNotifications));
console.log('✅ Test notifications created!');
```

### 3. Test the Features

Now click the **notification bell** in the navbar and test these features:

#### Basic Features:
- ✅ **Bell Badge**: Should show "4" (unread count)
- ✅ **Popup Opens**: Click bell to open notification center
- ✅ **Priority Colors**: Notice different colored borders (red for high, orange for medium, etc.)

#### Advanced Features:
- ✅ **Filter Tabs**: Click "All", "Unread", "Read" tabs
- ✅ **Search**: Type "lead" or "task" in the search box
- ✅ **Category Filter**: Select different notification types from dropdown
- ✅ **Compact View**: Click the "⋯" button to toggle compact/detailed view
- ✅ **Mark as Read**: Click on unread notifications or use the checkmark button
- ✅ **Mark All Read**: Click "Mark all as read" button
- ✅ **Delete**: Hover over notifications and click trash icon
- ✅ **Refresh**: Click refresh button to reload notifications

#### Visual Elements to Notice:
- 🔴 **High Priority**: Red border and background (task overdue, warning)
- 🟠 **Medium Priority**: Orange border and background (lead assignment)
- ⚪ **Low Priority**: Gray border and background (system notice)
- 🔵 **Normal Priority**: Blue border and background (success)
- 📍 **Unread Indicator**: Blue dot on left side
- 🏷️ **Priority Badges**: "HIGH", "MEDIUM", "LOW" badges in top-right
- ⏰ **Time Stamps**: "15m ago", "3h ago", etc.

### 4. Test Error Handling

Clear the test data to see error handling:
```javascript
localStorage.removeItem('test_notifications');
```

Then click the notification bell - you should see:
- Loading spinner initially
- Error message with "Try Again" button (since API might be unavailable)
- Graceful fallback behavior

### 5. Restore Test Data

Re-run the test data creation code from step 2 to continue testing.

## Expected Behavior

✅ **What Should Work:**
- Bell shows correct unread count with pulsing animation
- Popup opens/closes properly
- All filters work together (tabs + search + category)
- Priority styling shows correctly
- Actions work (mark as read, delete)
- Responsive design on different screen sizes
- Smooth animations and transitions

⚠️ **Current Limitations:**
- API endpoints may timeout (gracefully handled with test data fallback)
- Real-time updates depend on backend notifications system
- Test data persists in localStorage until cleared

## Production Readiness

The notification system is designed to:
- ✅ Work with real API when available
- ✅ Gracefully fallback to test data during development
- ✅ Handle network errors and timeouts
- ✅ Integrate with existing NotificationContext
- ✅ Maintain performance with large notification lists
- ✅ Provide excellent user experience

Once your backend API is fully accessible, simply remove the test data and the system will use real notifications automatically!
