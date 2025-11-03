import { useNotifications } from '../context/NotificationContext';

/**
 * A hook that provides access to notification functions but doesn't trigger any fetches
 * This avoids duplicate fetching since the NotificationContext already fetches on mount
 */
const useNotificationCheck = () => {
  // Get the notification context
  const notificationContext = useNotifications();
  
  return notificationContext;
};

export default useNotificationCheck;
