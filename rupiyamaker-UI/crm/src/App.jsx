import { useState, useEffect, useRef } from "react"
import { Routes, Route, useLocation, useNavigate } from "react-router-dom"
import './App.css'
import { AppProvider } from './context/AppContext'
import useNotificationCheck from './hooks/useNotificationCheck'
import { RouteErrorBoundary } from './components/ErrorBoundary'
import Login from './components/Login'
import TopNavbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import PublicLeadForm from "./components/PublicLeadForm"
import PublicLoginForm from "./components/PublicLoginForm"
import PublicAppViewer from "./components/PublicAppViewer"
import OptimizedAppRoutes from './routes/OptimizedAppRoutes'
import PopNotificationModal from './components/PopNotificationModal'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import sessionMonitor, { setSessionLogoutCallback } from './utils/sessionMonitor'
import { clearProfilePhotoFromStorage } from './utils/profilePhotoUtils'
import { API_BASE_URL } from './config/api'

function App() {
  // Global zoom styles for 80% sizing across the application
  const globalZoomStyles = `
    html {
      font-size: 15.36px; /* 96% of default 16px (80% + 20% increase) */
    }
    
    body {
      font-size: 0.96rem;
      line-height: 1.5;
    }
    
    /* Scale all text elements to 96% */
    h1, h2, h3, h4, h5, h6, p, span, div, a, button, input, select, textarea, label, td, th, li {
      font-size: inherit;
    }
    
    /* Specific scaling for common text sizes */
    .text-xs { font-size: 0.72rem; }
    .text-sm { font-size: 0.84rem; }
    .text-base { font-size: 0.96rem; }
    .text-lg { font-size: 1.08rem; }
    .text-xl { font-size: 1.2rem; }
    .text-2xl { font-size: 1.5rem; }
    .text-3xl { font-size: 1.8rem; }
    .text-4xl { font-size: 2.16rem; }
    .text-5xl { font-size: 2.88rem; }
    .text-6xl { font-size: 3.6rem; }
  `;

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedLabel, setSelectedLabel] = useState("")
  const [isMobileView, setIsMobileView] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  
  // Global Announcement Modal State
  const [showGlobalAnnouncement, setShowGlobalAnnouncement] = useState(false)
  const [globalAnnouncementData, setGlobalAnnouncementData] = useState(null)
  const notificationSoundRef = useRef(null)
  const soundIntervalRef = useRef(null)
  const checkNotificationsRef = useRef(null)

  // Sound state management
  const [isSoundPlaying, setIsSoundPlaying] = useState(false)
  const soundCleanupRef = useRef(null)

  // Volume control functions
  const setNotificationVolume = (volume) => {
    // Volume should be between 0 and 0.5 for office safety
    const safeVolume = Math.max(0, Math.min(0.5, volume));
    localStorage.setItem('notificationVolume', safeVolume.toString());
    console.log(`🔊 Notification volume set to ${safeVolume}`);
  };

  const getNotificationVolume = () => {
    const stored = localStorage.getItem('notificationVolume');
    return stored ? parseFloat(stored) : 0.3; // Default to 30% volume
  };
  
  // Ref to prevent useEffect loops when programmatically setting selectedLabel
  const skipNextRouteEffect = useRef(false)
  
  // Initialize selectedLabel based on current URL on first load
  useEffect(() => {
    const currentPath = location.pathname
    const urlParams = new URLSearchParams(location.search)
    const loanTypeName = urlParams.get('loan_type_name')
    
    // Check if this is a public route that should work on mobile
    const isPublicRoute = currentPath.includes('/public/') || currentPath.includes('/login-form/');
    
    // For mobile view, use Feed for authenticated routes only
    if (window.innerWidth < 768) {
      setIsMobileView(true)
      
      // Don't override label for public routes on mobile
      if (!isPublicRoute) {
        setSelectedLabel('Feed')
        return
      }
    }
    
    // First check if we have a loan type parameter in the URL
    if (loanTypeName) {
      if (currentPath.includes('/lead-crm') || currentPath.includes('/leads')) {
        setSelectedLabel(loanTypeName)
        return
      } else if (currentPath.includes('/login-crm') || currentPath.includes('/login')) {
        setSelectedLabel(`${loanTypeName} Login`)
        return
      }
    }
    
    // Check if selectedLabel is already stored and matches current path
    const storedLabel = localStorage.getItem('selectedLabel')
    if (storedLabel && currentPath === '/notifications' && storedLabel === 'Announcement') {
      setSelectedLabel('Announcement')
      return
    }
    
    // Fall back to static path mapping
    const matchingLabel = Object.entries({
      'Feed': '/feed',
      'Lead CRM': '/lead-crm',
      'LEAD Dashboard': '/lead-dashboard',
      'Create LEAD': '/create-lead',
      'PL & ODD LEADS': '/pl-odd-leads',
      'Home Loan Updates': '/home-loan-updates',
      'LOGIN Dashboard': '/login-crm',
      'Login CRM': '/login-crm',
      'Charts': '/charts',
      'Apps': '/apps',
      'Ticket': '/tickets',
      'Interview Panel': '/interview-panel',
      'PL & ODD LOGIN': '/pl-odd-login',
      'Home Loan LOGIN': '/home-loan-login',
      'Task': '/tasks',
      'Employees': '/employees',
      'Leave': '/leaves',
      'Leaves': '/leaves',
      'Attendance': '/attendance',
      'Warning Management': '/warnings',
      'Warning': '/warnings',
      'Warning Dashboard': '/warnings',
      'All Warnings': '/warnings',
      'My Warnings': '/warnings',
      'Add Task': '/add-task',
      'Settings': '/settings',
      'Reports': '/reports',
      'Announcement': '/notifications',
      'All Notifications': '/notifications'
    }).find(([_, path]) => path === currentPath)
    
    if (matchingLabel) {
      setSelectedLabel(matchingLabel[0])
    } else {
      // If no matching path found and not mobile, don't default to Feed
      // Let the user navigate to what they want
      setSelectedLabel('')
    }
  }, []) // Run only on initial mount

  // Use the notification check hook to ensure notifications are checked when the app loads
  useNotificationCheck()

  // Mobile view detection with proper state management
  useEffect(() => {
    const checkMobileView = () => {
      const wasMobile = isMobileView;
      const isMobile = window.innerWidth < 768; // md breakpoint
      setIsMobileView(isMobile);
      
      // If switching from mobile to desktop, restore proper navigation
      if (wasMobile && !isMobile && selectedLabel === 'Feed') {
        // User switched from mobile to desktop view
        // Keep current URL but ensure proper label is set
        const currentPath = location.pathname;
        if (currentPath !== '/feed' && currentPath !== '/') {
          // Trigger label update based on URL when switching to desktop
          setTimeout(() => {
            const urlParams = new URLSearchParams(location.search);
            const loanTypeName = urlParams.get('loan_type_name');
            
            if (loanTypeName) {
              if (currentPath.includes('/lead-crm') || currentPath.includes('/leads')) {
                setSelectedLabel(loanTypeName);
              } else if (currentPath.includes('/login-crm') || currentPath.includes('/login')) {
                setSelectedLabel(`${loanTypeName} Login`);
              }
            }
          }, 50);
        }
      }
      
      // If switching from desktop to mobile, navigate to feed if not already there
      // BUT exclude public routes (they should work on mobile)
      const isPublicRoute = location.pathname.includes('/public/') || location.pathname.includes('/login-form/');
      
      if (!wasMobile && isMobile && location.pathname !== '/feed' && location.pathname !== '/' && !isPublicRoute) {
        // User switched from desktop to mobile view
        navigate('/feed', { replace: true });
        setSelectedLabel('Feed');
      }
    };

    // Initial check
    checkMobileView();

    // Add resize listener for dynamic updates
    window.addEventListener('resize', checkMobileView);
    
    // Also listen for orientation changes on mobile devices
    window.addEventListener('orientationchange', () => {
      setTimeout(checkMobileView, 100); // Small delay to ensure proper width reading
    });

    return () => {
      window.removeEventListener('resize', checkMobileView);
      window.removeEventListener('orientationchange', checkMobileView);
    };
  }, [isMobileView, location.pathname, location.search, navigate])

  useEffect(() => {
    // Check if user is already logged in
    const userData = localStorage.getItem('userData')
    const authStatus = localStorage.getItem('isAuthenticated')

    if (userData && authStatus === 'true') {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      setIsAuthenticated(true)
      
      // Ensure profile photo is available in the expected localStorage keys
      if (parsedUser.profile_photo) {
        localStorage.setItem('profile_photo', parsedUser.profile_photo)
        localStorage.setItem('userProfilePhoto', parsedUser.profile_photo)
      }
      
      // Start session monitoring when user is authenticated
      // console.log('Starting session monitoring for authenticated user')
      sessionMonitor.start()
    }
    
    // Set up logout callback for session monitor
    setSessionLogoutCallback(() => {
      // console.log('Session monitor triggered logout - updating app state')
      setUser(null)
      setIsAuthenticated(false)
    })
    
    setLoading(false)
  }, [])

  // Handle window resize to maintain mobile behavior
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768; // md breakpoint
      const isPublicRoute = location.pathname.includes('/public/') || location.pathname.includes('/login-form/');
      
      if (isMobile && !isPublicRoute) {
        setSelectedLabel('Feed');
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [location.pathname])

  // Update selected label based on current route and view mode
  useEffect(() => {
    // Skip this effect if we just programmatically set the label
    if (skipNextRouteEffect.current) {
      skipNextRouteEffect.current = false;
      return;
    }
    
    // Check if this is a public route
    const isPublicRoute = location.pathname.includes('/public/') || location.pathname.includes('/login-form/');
    
    // On mobile view, only set Feed if we're actually on the feed route or root AND not on public route
    if (isMobileView) {
      if ((location.pathname === '/feed' || location.pathname === '/') && !isPublicRoute) {
        setSelectedLabel('Feed');
      }
      return;
    }

    // Desktop view - determine label from URL
    const currentPath = location.pathname
    const urlParams = new URLSearchParams(location.search)
    const loanTypeName = urlParams.get('loan_type_name')
    
    // First check if we have a loan type parameter in the URL
    if (loanTypeName) {
      // Determine which CRM this is for based on the path
      if (currentPath.includes('/lead-crm') || currentPath.includes('/leads')) {
        // For Lead CRM, use the loan type name as is
        setSelectedLabel(loanTypeName)
        return
      } else if (currentPath.includes('/login-crm') || currentPath.includes('/login')) {
        // For Login CRM, add "Login" suffix to the loan type name
        setSelectedLabel(`${loanTypeName} Login`)
        return
      }
    }
    
    // Define path mappings
    const pathMappings = {
      'Feed': '/feed',
      'Lead CRM': '/lead-crm',
      'LEAD Dashboard': '/lead-dashboard',
      'Create LEAD': '/create-lead',
      'PL & ODD LEADS': '/pl-odd-leads',
      'Home Loan Updates': '/home-loan-updates',
      'LOGIN Dashboard': '/login-crm',
      'Login CRM': '/login-crm',
      'Charts': '/charts',
      'Apps': '/apps',
      'Ticket': '/tickets',
      'Interview Panel': '/interview-panel',
      'PL & ODD LOGIN': '/pl-odd-login',
      'Home Loan LOGIN': '/home-loan-login',
      'Task': '/tasks',
      'Employees': '/employees',
      'Leave': '/leaves',
      'Leaves': '/leaves',
      'Attendance': '/attendance',
      'Warning Management': '/warnings',
      'Warning': '/warnings',
      'Warning Dashboard': '/warnings',
      'All Warnings': '/warnings',
      'My Warnings': '/warnings',
      'Add Task': '/add-task',
      'Settings': '/settings',
      'Reports': '/reports',
      'Announcement': '/notifications',
      'All Notifications': '/notifications'
    }
    
    // Check if current selectedLabel already maps to the current path
    // This prevents unwanted overrides when multiple labels map to same route
    const currentLabelPath = pathMappings[selectedLabel]
    if (currentLabelPath === currentPath) {
      // Current label is already correct for this path, don't change it
      return
    }
    
    // Special handling for notifications route - preserve recent user selection
    if (currentPath === '/notifications') {
      const storedLabel = localStorage.getItem('selectedLabel')
      const lastChangeTime = localStorage.getItem('selectedLabelChangeTime')
      const currentTime = Date.now()
      
      // If user recently selected a label (within 2 seconds) and it maps to notifications, respect it
      if (storedLabel && pathMappings[storedLabel] === '/notifications' && 
          lastChangeTime && (currentTime - parseInt(lastChangeTime)) < 2000) {
        if (storedLabel !== selectedLabel) {
          setSelectedLabel(storedLabel)
          skipNextRouteEffect.current = true;
        }
        return
      }
      
      // If current selectedLabel is already valid for notifications, keep it
      if (pathMappings[selectedLabel] === '/notifications') {
        return
      }
      
      // Default to Announcement for notifications route
      if (selectedLabel !== 'Announcement') {
        setSelectedLabel('Announcement')
        skipNextRouteEffect.current = true;
      }
      return
    }
    
    // Fall back to static path mapping for other routes
    const matchingLabels = Object.entries(pathMappings).filter(([_, path]) => path === currentPath)
    if (matchingLabels.length > 0) {
      setSelectedLabel(matchingLabels[0][0])
    }
  }, [location.pathname, location.search, isMobileView]) // Also listen to mobile view changes

  // Store selectedLabel in localStorage when it changes
  useEffect(() => {
    localStorage.setItem('selectedLabel', selectedLabel)
    localStorage.setItem('selectedLabelChangeTime', Date.now().toString())
  }, [selectedLabel])

  // Listen for sidebar selection changes from components (legacy support)
  useEffect(() => {
    const handleSidebarSelectionChange = (event) => {
      const { selection } = event.detail;
      if (selection) {
        setSelectedLabel(selection);
      }
    };
    
    window.addEventListener('sidebarSelectionChange', handleSidebarSelectionChange);
    return () => window.removeEventListener('sidebarSelectionChange', handleSidebarSelectionChange);
  }, []);

  // Cleanup session monitoring and notification state on component unmount
  useEffect(() => {
    return () => {
      // console.log('App unmounting - stopping session monitoring')
      sessionMonitor.stop()

      // Clean up notification state on page unload
      console.log('🧹 Cleaning up notification state on page unload');

      // Clear notification cache to prevent stale data on next load
      localStorage.removeItem('notificationCache');

      // Clear global notification trigger
      localStorage.removeItem('globalNotificationTrigger');

      // COMPREHENSIVE SOUND CLEANUP ON PAGE UNLOAD
      cleanupAllSounds();

      // Note: We don't clear 'pendingAnnouncement' here as it should persist across page reloads
      // until the user acknowledges it
    }
  }, [])

  // Add page unload and navigation cleanup listeners
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Clean up sounds when page is being unloaded/refreshed
      cleanupAllSounds();
      // Don't prevent the default behavior - allow page to reload/close without alert
    };

    const handleUnload = () => {
      // Final cleanup when page is actually unloading
      cleanupAllSounds();
    };

    const handlePopState = () => {
      // Clean up sounds when user navigates back/forward
      cleanupAllSounds();
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
    setIsAuthenticated(true)
    
    // Start session monitoring when user logs in
    // console.log('User logged in - starting session monitoring')
    sessionMonitor.start()
  }

  const handleLogout = () => {
    // Stop session monitoring before clearing data
    // console.log('User logging out - stopping session monitoring')
    sessionMonitor.stop()
    
    // Clear profile photo using utility function
    clearProfilePhotoFromStorage()
    
    localStorage.removeItem('userData')
    localStorage.removeItem('isAuthenticated')
    localStorage.removeItem('token') // Clear the token
    localStorage.removeItem('userId')
    localStorage.removeItem('user_id')
    localStorage.removeItem('userPermissions')
    localStorage.removeItem('profile_photo') // Clear profile photo
    localStorage.removeItem('userProfilePhoto') // Clear legacy profile photo key
    localStorage.removeItem('user') // Clear user object
    setUser(null)
    setIsAuthenticated(false)
  }

  // GLOBAL: Check for global notification triggers
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkGlobalNotificationTrigger = () => {
      try {
        const trigger = localStorage.getItem('globalNotificationTrigger');
        if (trigger) {
          const triggerData = JSON.parse(trigger);
          const triggerAge = Date.now() - triggerData.timestamp;

          // Only process triggers that are less than 30 seconds old
          if (triggerAge < 30000) {
            console.log('🚨 Global notification trigger detected:', triggerData);

            // Clear the trigger immediately to prevent repeated processing
            localStorage.removeItem('globalNotificationTrigger');

            // Force an immediate notification check
            if (checkNotificationsRef.current) {
              console.log('🔄 Forcing immediate notification check due to global trigger');
              checkNotificationsRef.current();
            }
          } else {
            // Clean up old triggers
            localStorage.removeItem('globalNotificationTrigger');
          }
        }
      } catch (error) {
        console.error('Error checking global notification trigger:', error);
        localStorage.removeItem('globalNotificationTrigger');
      }
    };

    // Check for triggers immediately
    checkGlobalNotificationTrigger();

    // Set up interval to check for triggers
    const triggerCheckInterval = setInterval(checkGlobalNotificationTrigger, 1000);

    return () => {
      clearInterval(triggerCheckInterval);
    };
  }, [isAuthenticated]);

  // GLOBAL: Poll for new notifications (works on ALL pages)
  useEffect(() => {
    // Only poll if user is authenticated
    if (!isAuthenticated) return;

    let pollInterval = null;
    let consecutiveErrors = 0;
    let currentInterval = 3000; // Start with 3 second interval for immediate notification updates
    const maxInterval = 10000; // Max 10 seconds
    const backoffMultiplier = 1.5;

    const checkForNewNotifications = async () => {
      try {
        // Get user ID from multiple possible sources
        const userId = localStorage.getItem('userId') ||
                      localStorage.getItem('user_id') ||
                      user?._id ||
                      user?.id;

        if (!userId) {
          console.log('No user ID found for notification polling');
          return;
        }

        console.log('🔍 Polling for notifications - User ID:', userId, 'Interval:', currentInterval + 'ms');

        const response = await fetch(`${API_BASE_URL}/pop-notifications/my-notifications?user_id=${userId}&cache_buster=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (response.ok) {
          const notifications = await response.json();

          console.log('Received notifications:', notifications.length);

          // Reset error count on successful response (keep interval as-is)
          consecutiveErrors = 0;

          // ✨ CRITICAL FIX: Check if currently showing notification is still active
          if (showGlobalAnnouncement && globalAnnouncementData) {
            const currentlyShowingId = globalAnnouncementData.notificationId;
            const isStillActive = notifications.some(n => 
              (n.id || n._id) === currentlyShowingId
            );
            
            if (!isStillActive) {
              console.log('🚫 Currently showing notification is no longer active - hiding immediately');
              setShowGlobalAnnouncement(false);
              setGlobalAnnouncementData(null);
              localStorage.removeItem('pendingAnnouncement');
              
              // Stop any playing sounds
              if (notificationSoundRef.current) {
                notificationSoundRef.current.pause();
                notificationSoundRef.current.currentTime = 0;
              }
              if (soundIntervalRef.current) {
                clearInterval(soundIntervalRef.current);
                soundIntervalRef.current = null;
              }
            }
          }

          // If there are active notifications and no current announcement is showing
          if (notifications.length > 0 && !showGlobalAnnouncement) {
            const firstNotification = notifications[0];

            console.log('First notification:', firstNotification);

            // Enhanced notification versioning and caching
            const notificationCache = JSON.parse(localStorage.getItem('notificationCache') || '{}');
            const currentNotificationId = firstNotification.id || firstNotification._id;
            const lastNotificationId = notificationCache.lastNotificationId;
            const lastCheckTime = notificationCache.lastCheckTime || 0;

            // Check if this is a new notification or if enough time has passed
            const isNewNotification = currentNotificationId !== lastNotificationId ||
                                    (Date.now() - lastCheckTime) > 5000; // 5 second grace period

            if (isNewNotification) {
              console.log('🔔 NEW NOTIFICATION DETECTED - Playing sound and showing modal');

              // Update notification cache
              notificationCache.lastNotificationId = currentNotificationId;
              notificationCache.lastCheckTime = Date.now();
              localStorage.setItem('notificationCache', JSON.stringify(notificationCache));

              // Play notification sound
              playNotificationSound();

              // Format timestamp
              const now = new Date();
              const options = {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              };
              const timestamp = 'Sent: ' + now.toLocaleDateString('en-GB', options).replace(',', '');

              const announcementPayload = {
                title: firstNotification.title,
                message: firstNotification.message,
                senderName: firstNotification.sender_name || 'Admin',
                senderRole: 'ADMIN',
                targetCount: firstNotification.acceptance_stats?.total_users || 1,
                notificationId: currentNotificationId,
                notificationType: firstNotification.notification_type || 'general',
                priority: firstNotification.priority || 'normal',
                timestamp: timestamp,
                acceptedCount: 0,
                isAcknowledged: false,
                version: firstNotification.version || 1
              };

              // Store in localStorage for persistence
              localStorage.setItem('pendingAnnouncement', JSON.stringify(announcementPayload));

              // Show the announcement
              setGlobalAnnouncementData(announcementPayload);
              setShowGlobalAnnouncement(true);
            }
          } else if (notifications.length === 0) {
            // ✨ CRITICAL FIX: If no notifications returned and one is currently showing,
            // it means the notification was deactivated - immediately hide it
            if (showGlobalAnnouncement && globalAnnouncementData) {
              console.log('🚫 Notification was deactivated - hiding immediately');
              setShowGlobalAnnouncement(false);
              setGlobalAnnouncementData(null);
              localStorage.removeItem('pendingAnnouncement');
              
              // Stop any playing sounds
              if (notificationSoundRef.current) {
                notificationSoundRef.current.pause();
                notificationSoundRef.current.currentTime = 0;
              }
              if (soundIntervalRef.current) {
                clearInterval(soundIntervalRef.current);
                soundIntervalRef.current = null;
              }
            }
            
            // Clear notification cache if no notifications
            const notificationCache = JSON.parse(localStorage.getItem('notificationCache') || '{}');
            notificationCache.lastNotificationId = null;
            localStorage.setItem('notificationCache', JSON.stringify(notificationCache));
          }
        } else {
          console.error('Failed to fetch notifications:', response.status);
          consecutiveErrors++;

          // Implement exponential backoff on errors
          if (consecutiveErrors > 3) {
            currentInterval = Math.min(currentInterval * backoffMultiplier, maxInterval);
            console.log(`📈 Increasing polling interval due to errors: ${currentInterval}ms`);
          }
        }
      } catch (error) {
        console.error('Error checking for new notifications:', error);
        consecutiveErrors++;

        // Implement exponential backoff on errors
        if (consecutiveErrors > 3) {
          currentInterval = Math.min(currentInterval * backoffMultiplier, maxInterval);
          console.log(`📈 Increasing polling interval due to errors: ${currentInterval}ms`);
        }
      }
    };

    // Store function in ref for global access
    checkNotificationsRef.current = checkForNewNotifications;

    // Check immediately on mount
    checkForNewNotifications();

    // Poll with adaptive interval (30 second base, exponential backoff on errors)
    pollInterval = setInterval(checkForNewNotifications, currentInterval);

    // Expose function globally so notification creation can trigger immediate check
      window.triggerNotificationCheck = () => {
        console.log('🔔 Manual notification check triggered');
        checkForNewNotifications();
      };
 
      // Expose sound control functions for testing and user control
      window.setNotificationVolume = setNotificationVolume;
      window.getNotificationVolume = getNotificationVolume;
      window.testNotificationSound = () => {
        console.log('🧪 Testing notification sound...');
        playNotificationSound();
        setTimeout(() => {
          console.log('🛑 Stopping test sound after 3 seconds');
          cleanupAllSounds();
        }, 3000);
      };

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      delete window.triggerNotificationCheck;
      delete window.setNotificationVolume;
      delete window.getNotificationVolume;
      delete window.testNotificationSound;

      // Clean up sounds when polling stops
      cleanupAllSounds();
    };
  }, [isAuthenticated, showGlobalAnnouncement, user]);

  // GLOBAL: Load pending announcement from localStorage on mount
  useEffect(() => {
    if (!isAuthenticated) return;

    const pendingAnnouncement = localStorage.getItem('pendingAnnouncement');
    if (pendingAnnouncement) {
      try {
        const announcementData = JSON.parse(pendingAnnouncement);
        setGlobalAnnouncementData(announcementData);
        setShowGlobalAnnouncement(true);
      } catch (error) {
        console.error('Error loading pending announcement:', error);
        localStorage.removeItem('pendingAnnouncement');
      }
    }
  }, [isAuthenticated]);

  // GLOBAL: Play notification sound - OFFICE-FRIENDLY WITH CONFIGURABLE VOLUME
  const playNotificationSound = () => {
    // Prevent multiple concurrent sound intervals
    if (isSoundPlaying) {
      console.log('🔊 Sound already playing, skipping duplicate');
      return;
    }

    setIsSoundPlaying(true);

    const playSingleBeep = () => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Office-friendly beep pattern with configurable volume
        const playBeep = (delay, duration, frequency, volume) => {
          setTimeout(() => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.value = frequency;
            osc.type = 'sine';
            gain.gain.value = volume;

            // Smooth fade in/out for less aggressive sound
            gain.gain.setValueAtTime(0, audioContext.currentTime);
            gain.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.05);
            gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);

            osc.start(audioContext.currentTime);
            osc.stop(audioContext.currentTime + duration);
          }, delay);
        };

        // Get user preference for volume using the control function
        const volume = getNotificationVolume();

        // GENTLE DOUBLE BEEP PATTERN - Less aggressive than triple beep
        playBeep(0, 0.2, 800, volume);      // First beep - lower frequency, gentler
        playBeep(300, 0.2, 600, volume);    // Second beep - even lower frequency
      } catch (error) {
        console.error('❌ Error playing notification sound:', error);
        setIsSoundPlaying(false);
      }
    };

    // Clear any existing sound interval
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }

    // Play sound immediately
    console.log('🔊 STARTING OFFICE-FRIENDLY NOTIFICATION SOUND');
    playSingleBeep();

    // Then play every 7 seconds until acknowledged (less frequent than 5 seconds)
    soundIntervalRef.current = setInterval(() => {
      if (isSoundPlaying) { // Double-check sound is still supposed to be playing
        console.log('🔊 REPEATING NOTIFICATION SOUND...');
        playSingleBeep();
      }
    }, 7000); // Increased from 5000ms to 7000ms for less annoyance
  };
  
  // GLOBAL: Stop notification sound with proper cleanup
  const stopNotificationSound = () => {
    if (soundIntervalRef.current) {
      console.log('🔇 STOPPING NOTIFICATION SOUND');
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }

    // Reset sound state
    setIsSoundPlaying(false);

    // Clear any pending cleanup functions
    if (soundCleanupRef.current) {
      if (typeof soundCleanupRef.current === 'function') {
        soundCleanupRef.current();
      }
      soundCleanupRef.current = null;
    }
  };

  // GLOBAL: Comprehensive sound cleanup for page unload and navigation
  const cleanupAllSounds = () => {
    console.log('🧹 COMPREHENSIVE SOUND CLEANUP');

    // Stop current sound
    stopNotificationSound();

    // Clear any audio contexts that might be running
    try {
      if (window.audioContext && typeof window.audioContext.close === 'function') {
        window.audioContext.close();
        window.audioContext = null;
      }
    } catch (error) {
      console.warn('Error closing audio context:', error);
    }
  };

  // GLOBAL: Handle announcement acknowledgment
  const handleGlobalAnnouncementAcknowledge = async (e) => {
    // CRITICAL: Prevent ALL possible ways of page refresh
    if (e) {
      if (typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      if (typeof e.stopPropagation === 'function') {
        e.stopPropagation();
      }
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      // Prevent default on native event too
      if (e.nativeEvent && typeof e.nativeEvent.preventDefault === 'function') {
        e.nativeEvent.preventDefault();
      }
    }
    
    console.log('🎯 ACKNOWLEDGE BUTTON CLICKED - Starting process...');
    console.log('🛑 Event prevented, no refresh should happen');
    
    if (!globalAnnouncementData || !globalAnnouncementData.notificationId) {
      console.error('❌ No notification ID found');
      return false;
    }

    try {
      console.log('📤 Sending acknowledgment to backend...');
      console.log('🆔 Notification ID:', globalAnnouncementData.notificationId);
      console.log('📦 Full announcement data:', globalAnnouncementData);
      
      // Get user ID
      const userId = localStorage.getItem('userId') || 
                    localStorage.getItem('user_id') || 
                    user?._id || 
                    user?.id;
      
      console.log('👤 User ID:', userId);
      
      // Store notification ID before clearing state
      const notificationId = globalAnnouncementData.notificationId;
      
      // CRITICAL: Stop the repeating sound immediately with comprehensive cleanup
      cleanupAllSounds();
      
      // IMPORTANT: Clear localStorage FIRST to prevent modal from reopening
      localStorage.removeItem('pendingAnnouncement');
      
      // Close modal IMMEDIATELY (don't wait for API)
      console.log('✅ Closing modal NOW...');
      setShowGlobalAnnouncement(false);
      setGlobalAnnouncementData(null);

      // Call backend API to accept notification (in background)
      const response = await fetch(`${API_BASE_URL}/pop-notifications/accept?user_id=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          notification_id: notificationId
        })
      });

      console.log('📡 API Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ API Error:', errorData);
        // Don't throw error - modal is already closed
      } else {
        console.log('✅ Global notification acknowledged successfully in backend');
      }

    } catch (error) {
      console.error('Error in acknowledge handler:', error);
      
      // IMPORTANT: Modal should already be closed
      // Make sure it's closed and localStorage is cleared
      localStorage.removeItem('pendingAnnouncement');
      setShowGlobalAnnouncement(false);
      setGlobalAnnouncementData(null);
    }
    
    // CRITICAL: Return false to prevent any default behavior
    return false;
  };

  const ProtectedRoute = ({ children }) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-black">
          <div className="text-white text-xl">Loading...</div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return <Login onLogin={handleLogin} />;
    }

    return children;
  };

  return (
    <AppProvider>
      <style>{globalZoomStyles}</style>
      <RouteErrorBoundary routeName="Application">
        <Routes>
          {/* Public route for lead form - no authentication required */}
          <Route path="/public/lead-form/:shareToken" element={<PublicLeadForm />} />
          
          {/* Public route for login form - no authentication required */}
          <Route path="/login-form/:mobileNumber" element={<PublicLoginForm />} />
          <Route path="/public/login-form/:mobileNumber" element={<PublicLoginForm />} />
          
          {/* Public route for app viewer - no authentication required */}
          <Route path="/public/app/:shareToken" element={<PublicAppViewer />} />

          {/* Protected routes (requires authentication) */}
          <Route path="/*" element={
            <ProtectedRoute>
              <div className="flex h-screen bg-black text-white">
                {/* Sidebar - Hidden on mobile view, visible on desktop view */}
                {!isMobileView && (
                  <Sidebar selectedLabel={selectedLabel} setSelectedLabel={setSelectedLabel} />
                )}
                
                <div className="flex-1 flex flex-col overflow-hidden">
                  <TopNavbar
                    selectedLabel={selectedLabel}
                    userName={`${user?.first_name || ''} ${user?.last_name || ''}`}
                    onLogout={handleLogout}
                    user={user}
                  />
                  <div className="flex-1 overflow-y-auto">
                    {/* Conditional rendering based on view mode */}
                    {isMobileView ? (
                      // Mobile view - Force Feed component only with optimized styling
                      <div className="w-full min-h-screen bg-black">
                        <OptimizedAppRoutes user={user} selectedLabel={selectedLabel} />
                      </div>
                    ) : (
                      // Desktop view - Show all routes normally
                      <OptimizedAppRoutes user={user} selectedLabel={selectedLabel} />
                    )}
                  </div>
                </div>
                
                {/* Global Pop Notification Modal - REMOVED: Using new announcement modal in NotificationManagementPage */}
                {/* <PopNotificationModal user={user} /> */}
              </div>
            </ProtectedRoute>
          } />
        </Routes>

        {/* GLOBAL ANNOUNCEMENT MODAL - Shows on ALL pages */}
        {showGlobalAnnouncement && globalAnnouncementData && (
          <GlobalAnnouncementModal 
            announcementData={globalAnnouncementData}
            onAcknowledge={handleGlobalAnnouncementAcknowledge}
            onLogout={handleLogout}
          />
        )}

        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
      </RouteErrorBoundary>
    </AppProvider>
  )
}

// Global Announcement Modal Component
const GlobalAnnouncementModal = ({ announcementData, onAcknowledge, onLogout }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      const detailsContent = document.getElementById('global-announcement-details-content');
      const moreBtn = document.getElementById('global-announcement-more-btn');
      const modal = document.getElementById('global-announcement-modal');
      const acceptBtn = document.getElementById('global-announcement-accept-btn');
      const scrollIndicator = document.getElementById('global-announcement-scroll-indicator');
      const detailsOverlay = document.getElementById('global-announcement-details-overlay');
      
      if (!detailsContent || !moreBtn || !modal || !acceptBtn) return;
      
      let hasReadFullContent = false;
      const isTruncated = detailsContent.scrollHeight > detailsContent.clientHeight;
      
      if (isTruncated) {
        moreBtn.style.display = 'flex';
        acceptBtn.style.display = 'none';
        
        const handleMoreClick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const isExpanded = detailsContent.classList.contains('expanded');
          
          if (isExpanded) {
            detailsContent.classList.remove('expanded');
            modal.classList.remove('expanded');
            moreBtn.textContent = 'More Details';
            moreBtn.classList.remove('expanded');
            acceptBtn.style.display = 'none';
            if (scrollIndicator) scrollIndicator.classList.remove('show');
            if (detailsOverlay) detailsOverlay.style.opacity = '1';
            hasReadFullContent = false;
            modal.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            detailsContent.classList.add('expanded');
            modal.classList.add('expanded');
            moreBtn.textContent = 'Show Less';
            moreBtn.classList.add('expanded');
            if (scrollIndicator) scrollIndicator.classList.add('show');
            if (detailsOverlay) detailsOverlay.style.opacity = '0';
            setTimeout(() => {
              detailsContent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 150);
          }
        };
        
        moreBtn.addEventListener('click', handleMoreClick);
        
        const handleScroll = () => {
          if (modal.classList.contains('expanded')) {
            const scrollTop = modal.scrollTop;
            const scrollHeight = modal.scrollHeight;
            const clientHeight = modal.clientHeight;
            const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 50;
            
            if (scrolledToBottom && !hasReadFullContent) {
              hasReadFullContent = true;
              acceptBtn.style.display = 'flex';
              if (scrollIndicator) scrollIndicator.classList.remove('show');
              acceptBtn.style.animation = 'fadeInSuccess 0.5s ease';
            }
          }
        };
        
        modal.addEventListener('scroll', handleScroll);
        
        return () => {
          moreBtn.removeEventListener('click', handleMoreClick);
          modal.removeEventListener('scroll', handleScroll);
        };
      } else {
        moreBtn.style.display = 'none';
        acceptBtn.style.display = 'flex';
        if (detailsOverlay) detailsOverlay.style.display = 'none';
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: 'rgba(0, 0, 0, 0.25)',
        backdropFilter: 'blur(1px)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <style>{`
        @keyframes glowPulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.9; }
          100% { opacity: 0.6; }
        }

        @keyframes glowMove {
          0% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(20px, 10px) rotate(90deg); }
          50% { transform: translate(0, 20px) rotate(180deg); }
          75% { transform: translate(-20px, 10px) rotate(270deg); }
          100% { transform: translate(0, 0) rotate(360deg); }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes shimmer {
          0% { left: -100%; }
          50% { left: -100%; }
          100% { left: 100%; }
        }

        @keyframes fadeInSuccess {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .global-announcement-modal-wrapper {
          position: relative;
          background: rgba(0, 0, 0, 0.45);
          border-radius: 20px;
          width: 88%;
          max-width: 850px;
          max-height: 85vh;
          box-shadow: 0 0 15px rgba(0, 100, 255, 0.2);
          overflow: hidden;
          animation: fadeIn 0.35s ease;
          transition: all 0.4s ease;
        }

        .global-announcement-modal-wrapper.expanded {
          max-height: 90vh;
          overflow-y: auto;
        }

        .global-announcement-modal-wrapper::before {
          content: '';
          position: absolute;
          top: -10px;
          left: -10px;
          right: -10px;
          bottom: -10px;
          background: radial-gradient(circle at 25% 25%, rgba(0, 120, 255, 0.4) 0%, rgba(0, 120, 255, 0) 50%);
          border-radius: 25px;
          animation: glowPulse 4s infinite alternate, glowMove 15s infinite linear;
          z-index: -1;
          pointer-events: none;
        }

        .global-announcement-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 25px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .global-announcement-header-icon {
          font-size: 30px;
          text-shadow: 0 2px 5px rgba(0,0,0,0.4);
        }

        .global-announcement-header-title {
          font-size: 28px;
          font-weight: 800;
          color: #2196f3;
          letter-spacing: 0.8px;
          text-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }

        .global-announcement-sender-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 25px;
          padding-bottom: 18px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .global-announcement-sender {
          color: #00ff41;
          font-weight: 700;
          font-size: 20px;
          line-height: 1.4;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }

        .global-announcement-timestamp {
          color: #e0e0e0;
          font-weight: 700;
          font-size: 16px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }

        .global-announcement-section {
          margin-bottom: 25px;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.07);
        }

        .global-announcement-section-content {
          padding: 24px;
          background: linear-gradient(135deg, rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.15));
          border-left: 4px solid #42a5f5;
          border-radius: 0 8px 8px 0;
          color: #f0f0f0;
          line-height: 1.7;
          font-size: 18px;
          font-weight: 500;
          word-wrap: break-word;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
          position: relative;
        }

        .global-announcement-subject-content {
          font-size: 28px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 0.8px;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), 0 0 20px rgba(66, 165, 245, 0.3);
          line-height: 1.4;
          background: linear-gradient(135deg, #ffffff, #e3f2fd);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-transform: uppercase;
          position: relative;
          display: inline-block;
        }

        .global-announcement-subject-content::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 60px;
          height: 3px;
          background: linear-gradient(90deg, #42a5f5, #2196f3);
          border-radius: 2px;
          box-shadow: 0 2px 8px rgba(66, 165, 245, 0.4);
        }

        .global-announcement-details-content {
          max-height: 120px;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          margin-bottom: 15px;
          line-height: 1.8;
          font-size: 16px;
          font-weight: 600;
          color: #f5f5f5;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
          white-space: pre-wrap;
        }

        .global-announcement-details-content.expanded {
          max-height: none;
          overflow: visible;
          padding: 25px;
          background: linear-gradient(135deg, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.25));
          border-radius: 15px;
          border: 1px solid rgba(66, 165, 245, 0.3);
          margin: 20px 0;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3), 0 4px 15px rgba(66, 165, 245, 0.1);
          backdrop-filter: blur(10px);
          font-size: 17px;
          font-weight: 700;
          line-height: 1.9;
        }

        .global-announcement-details-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 40px;
          background: linear-gradient(to top, rgba(8,8,8,0.95) 0%, rgba(8,8,8,0) 100%);
          pointer-events: none;
          opacity: 1;
          transition: opacity 0.3s ease;
        }

        .global-announcement-more-btn {
          background: linear-gradient(135deg, rgba(66, 165, 245, 0.15), rgba(66, 165, 245, 0.25));
          border: 1px solid rgba(66, 165, 245, 0.4);
          border-radius: 10px;
          color: #42a5f5;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 24px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          width: 100%;
          justify-content: center;
          margin-top: 10px;
          box-shadow: 0 4px 12px rgba(66, 165, 245, 0.15);
        }

        .global-announcement-more-btn:hover {
          color: #ffffff;
          background: linear-gradient(135deg, #42a5f5, #1976d2);
          transform: translateY(-2px);
        }

        .global-announcement-more-btn::after {
          content: "▼";
          font-size: 16px;
          transition: all 0.3s;
          font-weight: bold;
        }

        .global-announcement-more-btn.expanded {
          background: linear-gradient(135deg, #f44336, #d32f2f);
          color: #ffffff;
        }

        .global-announcement-more-btn.expanded::after {
          content: "▲";
        }

        .global-announcement-accept-btn {
          width: 100%;
          padding: 18px;
          background: linear-gradient(135deg, #1976d2, #0d47a1);
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          box-shadow: 0 8px 22px rgba(25, 118, 210, 0.45);
          margin-top: 15px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .global-announcement-accept-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 28px rgba(25, 118, 210, 0.55);
          background: linear-gradient(135deg, #1565c0, #0a2b7d);
        }

        .global-announcement-footer {
          text-align: center;
          color: #757575;
          font-size: 14px;
          padding: 22px 0 12px;
          border-top: 1px solid rgba(255,255,255,0.08);
          margin-top: 18px;
          font-weight: 500;
        }

        .global-announcement-scroll-indicator {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: linear-gradient(135deg, #ff9800, #f57c00);
          color: white;
          padding: 12px 20px;
          border-radius: 25px;
          font-weight: 700;
          font-size: 14px;
          box-shadow: 0 4px 15px rgba(255, 152, 0, 0.4);
          z-index: 10000;
          display: none;
        }

        .global-announcement-scroll-indicator.show {
          display: block;
        }
      `}</style>

      <div 
        className="global-announcement-modal-wrapper"
        id="global-announcement-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '30px' }}>
          <div className="global-announcement-header">
            <div className="global-announcement-header-icon">📢</div>
            <div className="global-announcement-header-title">SYSTEM NOTIFICATION</div>
          </div>

          <div className="global-announcement-sender-row">
            <div className="global-announcement-sender">
              {announcementData.senderName} - {announcementData.senderRole || 'ADMIN'}
            </div>
            <div className="global-announcement-timestamp">
              {announcementData.timestamp || 'Just now'}
            </div>
          </div>

          <div className="global-announcement-section">
            <div className="global-announcement-section-content">
              <div className="global-announcement-subject-content">
                {announcementData.title || "NOTIFICATION"}
              </div>
            </div>
          </div>

          <div className="global-announcement-section">
            <div className="global-announcement-section-content">
              <div 
                className="global-announcement-details-content" 
                id="global-announcement-details-content"
              >
                {announcementData.message}
              </div>
              <div className="global-announcement-details-overlay" id="global-announcement-details-overlay"></div>
              <button 
                className="global-announcement-more-btn" 
                id="global-announcement-more-btn"
                type="button"
                style={{ display: 'none' }}
              >
                More Details
              </button>
            </div>
          </div>

          {/* Show either Logout or Acknowledge button based on notification type */}
          {announcementData.notificationType === 'logout' ? (
            <button
              id="global-announcement-accept-btn"
              className="global-announcement-accept-btn"
              style={{
                background: 'linear-gradient(135deg, #f44336, #b71c1c)',
                display: 'none'
              }}
              onClick={async (e) => {
                console.log('👆 Logout Button clicked!');
                console.log('🛑 Preventing all default behaviors...');
                
                // CRITICAL: Prevent ALL possible refresh triggers
                if (e) {
                  if (typeof e.preventDefault === 'function') {
                    e.preventDefault();
                  }
                  if (typeof e.stopPropagation === 'function') {
                    e.stopPropagation();
                  }
                  if (typeof e.stopImmediatePropagation === 'function') {
                    e.stopImmediatePropagation();
                  }
                  if (e.nativeEvent && typeof e.nativeEvent.preventDefault === 'function') {
                    e.nativeEvent.preventDefault();
                    e.nativeEvent.stopPropagation();
                  }
                }
                
                // Call the acknowledge handler first
                await onAcknowledge(e);
                
                // Then call the logout handler
                console.log('🔓 Logging out user...');
                onLogout();
                
                console.log('✅ Handler completed, ensuring modal closes...');
                
                return false; // Extra safety
              }}
              onMouseDown={(e) => {
                // Backup prevention on mouse down
                if (e && typeof e.preventDefault === 'function') {
                  e.preventDefault();
                }
                console.log('👆 Mouse down - preventing defaults');
              }}
              type="button"
            >
              <span style={{ fontWeight: 'bold', fontSize: '20px' }}>🔓</span>
              Logout & Acknowledge
            </button>
          ) : (
            <button
              id="global-announcement-accept-btn"
              className="global-announcement-accept-btn"
              onClick={async (e) => {
                console.log('👆 Button clicked!');
                console.log('🛑 Preventing all default behaviors...');
                
                // CRITICAL: Prevent ALL possible refresh triggers
                if (e) {
                  if (typeof e.preventDefault === 'function') {
                    e.preventDefault();
                  }
                  if (typeof e.stopPropagation === 'function') {
                    e.stopPropagation();
                  }
                  if (typeof e.stopImmediatePropagation === 'function') {
                    e.stopImmediatePropagation();
                  }
                  if (e.nativeEvent && typeof e.nativeEvent.preventDefault === 'function') {
                    e.nativeEvent.preventDefault();
                    e.nativeEvent.stopPropagation();
                  }
                }
                
                // Call the handler and wait for it to complete
                await onAcknowledge(e);
                
                console.log('✅ Handler completed, ensuring modal closes...');
                
                return false; // Extra safety
              }}
              onMouseDown={(e) => {
                // Backup prevention on mouse down
                if (e && typeof e.preventDefault === 'function') {
                  e.preventDefault();
                }
                console.log('👆 Mouse down - preventing defaults');
              }}
              type="button"
              style={{ display: 'none' }}
            >
              <span style={{ fontWeight: 'bold', fontSize: '20px' }}>✓</span>
              I Acknowledge & Continue
            </button>
          )}

          <div className="global-announcement-footer">
            This notification will remain until you acknowledge it
          </div>
        </div>
      </div>

      <div className="global-announcement-scroll-indicator" id="global-announcement-scroll-indicator">
        📜 Scroll down to continue
      </div>
    </div>
  );
};

export default App
