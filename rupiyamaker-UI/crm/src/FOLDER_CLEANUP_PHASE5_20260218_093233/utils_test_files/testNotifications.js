// Test Notification System - Helper Functions
// This file contains helper functions to test the notification system
// You can copy these functions into your browser console to test

// Create test notifications for development
window.createTestNotifications = function() {
  const testNotifications = [
    {
      _id: 'test-001',
      title: 'High Priority Task Overdue',
      message: 'The quarterly report submission is now 2 days overdue. Please complete immediately.',
      type: 'task_overdue',
      priority: 'high',
      read: false,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      user_id: '6852a2978d7cdc3a71c482a6'
    },
    {
      _id: 'test-002',
      title: 'New Lead Assignment',
      message: 'You have been assigned a new lead: John Smith from Acme Corp. Priority: Medium',
      type: 'lead',
      priority: 'medium',
      read: false,
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
      user_id: '6852a2978d7cdc3a71c482a6'
    },
    {
      _id: 'test-003',
      title: 'System Maintenance Notice',
      message: 'Scheduled maintenance will occur tonight from 11 PM to 1 AM. Please save your work.',
      type: 'system',
      priority: 'low',
      read: true,
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
      user_id: '6852a2978d7cdc3a71c482a6'
    },
    {
      _id: 'test-004',
      title: 'Task Due Soon',
      message: 'Your task "Client presentation preparation" is due in 2 hours.',
      type: 'task_due',
      priority: 'medium',
      read: false,
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      user_id: '6852a2978d7cdc3a71c482a6'
    },
    {
      _id: 'test-005',
      title: 'Success: Document Approved',
      message: 'Your loan application document has been successfully approved by the manager.',
      type: 'success',
      priority: 'normal',
      read: false,
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
      user_id: '6852a2978d7cdc3a71c482a6'
    },
    {
      _id: 'test-006',
      title: 'Warning: Multiple Login Attempts',
      message: 'Multiple failed login attempts detected from your account. Please secure your password.',
      type: 'warning',
      priority: 'high',
      read: false,
      created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
      user_id: '6852a2978d7cdc3a71c482a6'
    },
    {
      _id: 'test-007',
      title: 'Calendar Reminder',
      message: 'Meeting with client scheduled for tomorrow at 10:00 AM.',
      type: 'calendar',
      priority: 'normal',
      read: true,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      user_id: '6852a2978d7cdc3a71c482a6'
    },
    {
      _id: 'test-008',
      title: 'User Profile Updated',
      message: 'Your profile information has been successfully updated.',
      type: 'user',
      priority: 'low',
      read: true,
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
      user_id: '6852a2978d7cdc3a71c482a6'
    }
  ];

  // Store in localStorage for testing
  localStorage.setItem('test_notifications', JSON.stringify(testNotifications));
  
  console.log('✅ Created 8 test notifications with various types and priorities:');
  console.log('- 2 High Priority (task overdue, warning)');
  console.log('- 2 Medium Priority (lead, task due)');
  console.log('- 2 Low Priority (system, user)');  
  console.log('- 2 Normal Priority (success, calendar)');
  console.log('- 5 Unread, 3 Read');
  
  return testNotifications;
};

// Clear test notifications
window.clearTestNotifications = function() {
  localStorage.removeItem('test_notifications');
  console.log('🗑️ Cleared test notifications');
};

// Get test notifications
window.getTestNotifications = function() {
  const notifications = localStorage.getItem('test_notifications');
  return notifications ? JSON.parse(notifications) : [];
};

// Simulate notification bell functionality
window.testNotificationBell = function() {
  const notifications = window.getTestNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;
  
  console.log('🔔 Notification System Test Results:');
  console.log(`Total notifications: ${notifications.length}`);
  console.log(`Unread notifications: ${unreadCount}`);
  console.log(`Read notifications: ${notifications.length - unreadCount}`);
  
  // Group by type
  const byType = notifications.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {});
  
  console.log('📊 By Type:', byType);
  
  // Group by priority
  const byPriority = notifications.reduce((acc, n) => {
    acc[n.priority || 'normal'] = (acc[n.priority || 'normal'] || 0) + 1;
    return acc;
  }, {});
  
  console.log('🎯 By Priority:', byPriority);
  
  return {
    total: notifications.length,
    unread: unreadCount,
    byType,
    byPriority,
    notifications
  };
};

// Instructions for testing
console.log(`
🚀 Notification System Test Functions Available:

1. createTestNotifications() - Creates 8 sample notifications with different types and priorities
2. clearTestNotifications() - Removes all test notifications
3. getTestNotifications() - Gets current test notifications
4. testNotificationBell() - Shows notification statistics

To test:
1. Run: createTestNotifications()
2. Click the notification bell in the navbar
3. Test filtering, search, and actions
4. Run: testNotificationBell() to see stats

The test notifications include:
- Different types: task, lead, system, success, warning, calendar, user
- Different priorities: high, medium, low, normal
- Mix of read/unread status
- Various timestamps for realistic testing
`);

// Auto-create test notifications if none exist
if (!localStorage.getItem('test_notifications')) {
  console.log('📝 No test notifications found. Creating sample data...');
  window.createTestNotifications();
}
