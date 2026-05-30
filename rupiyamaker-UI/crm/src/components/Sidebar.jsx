"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from "../lib/utils.js";
import { hasPermission, getUserPermissions, isSuperAdmin, canViewLoginCRM, canViewInterviewPanel, canViewReports, canViewNotifications } from '../utils/permissions';
import { useAppNavigation, getRouteByLabel, ROUTES } from '../utils/navigation';
import { setupPermissionRefreshListeners } from '../utils/immediatePermissionRefresh.js';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

// Icons mapping - optimized for mobile with responsive sizes
const icons = {
  Feed: <img src="/Images/marketing.png" className="h-5 w-5 sm:h-6 sm:w-6" alt="Feed" />,
  "LEAD CRM": <img src="/Images/filter.png" className="h-5 w-5 sm:h-6 sm:w-6" alt="LEAD CRM" />,
  "CRM Dashboard": <img src="/Images/dashboard (1).png" className="h-5 w-5 sm:h-6 sm:w-6" alt="CRM Dashboard" />,
  "Create LEAD": <img src="/Images/deal.png" className="h-5 w-5 sm:h-6 sm:w-6" alt="Create LEAD" />,
  "PL & ODD LEADS": <img src="/Images/dollars-money-bag-on-a-hand.png" className="h-5 w-5 sm:h-6 sm:w-6" alt="PL & ODD LEADS" />,
  "Login CRM": <img src="/Images/handshake.png" className="h-5 w-5 sm:h-6 sm:w-6 font-bold" alt="Login CRM" />,
  Dashboard: <img src="/Images/dashboard (2).png" className="h-5 w-5 sm:h-6 sm:w-6" alt="Dashboard" />,
  Task: <img src="/Images/task (1).png" className="h-5 w-5 sm:h-6 sm:w-6" alt="Task" />,
  Ticket: <img src="/Images/tickets.png" className="h-5 w-5 sm:h-6 sm:w-6" alt="Ticket" />,
  Notifications: (
    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  Announcement: (
    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  Warning: (
    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 9v2M12 15h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
    </svg>
  ),
  "Interview Panel": (
    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  HRMS: (
    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21a7.5 7.5 0 0113 0" />
    </svg>
  ),
  "Employees": (
    <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="12" r="3" />
      <path d="M6 15c-2.67 0-8 1.34-8 4v1h32v-1c0-2.66-5.33-4-8-4" />
    </svg>
  ),
  "Leave": (
    <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 12l2-2 4 4 8-8 2 2-10 10z" />
    </svg>
  ),
  "Attendance": (
    <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 2v4M16 2v4" />
    </svg>
  ),
  "Offer Letter": (
    <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  "Daily Performance": (
    <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 4h11v2H6v9H4V4z" />
      <path d="M12 12v4M9 14h6" />
    </svg>
  ),
  "Dialer Report": (
    <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  Apps: (
    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  ),
  Reports: (
    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 19c-5 0-8-3-8-8s3-8 8-8 8 3 8 8-3 8-8 8z" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  ),
  Settings: (
    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1h-.09a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h.09a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.09a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
};

// HubSpot-style rail: icon only; label on hover tooltip to the right
const MenuItem = React.memo(({ label, icon, selectedLabel, onSelect, showRailTip, scheduleRailOverlayClose, cancelRailOverlayClose }) => {
  const [internalUpdate, setInternalUpdate] = useState(0);
  const isSelected = useMemo(() => {
    const stored = localStorage.getItem('selectedLabel');

    if (selectedLabel) return selectedLabel === label;
    if (stored) return stored === label;

    const currentPath = window.location.pathname;
    return (
      (label === 'Announcement' && currentPath.includes('/notification')) ||
      (label === 'Task' && currentPath.includes('/task')) ||
      (label === 'Ticket' && currentPath.includes('/ticket')) ||
      (label === 'Apps' && currentPath.includes('/app')) ||
      (label === 'Reports' && currentPath.includes('/report')) ||
      (label === 'Settings' && currentPath.includes('/setting')) ||
      (label === 'Feed' && (currentPath === '/feed' || currentPath === '/')) ||
      (label === 'Interview Panel' && currentPath.includes('/interview-panel')) ||
      (label === 'Offer Letter' && currentPath.includes('/offer-letter')) ||
      (label === 'Warning' && currentPath.includes('/warning'))
    );
  }, [selectedLabel, label, internalUpdate]);

  const handleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    localStorage.setItem('selectedLabel', label);

    setInternalUpdate(prev => prev + 1);

    window.dispatchEvent(new CustomEvent('sidebarSelectionChange', {
      detail: { selection: label }
    }));

    onSelect(label);
  }, [label, onSelect]);

  const activeStyle = isSelected ? {
    boxShadow: '0 0 15px rgba(255,235,0,0.25), inset 0 0 8px rgba(255,235,0,0.07)',
    border: '1px solid rgba(255,235,0,0.45)',
  } : {};

  return (
    <button
      type="button"
      className={cn(
        'flex items-center justify-center w-11 h-11 mx-auto rounded-full transition-all border border-transparent shrink-0',
        isSelected
          ? 'bg-[#ffeb00] text-black'
          : 'text-[#00d2ff] hover:bg-white hover:text-black'
      )}
      style={activeStyle}
      onClick={handleClick}
      onMouseEnter={(e) => {
        cancelRailOverlayClose();
        const r = e.currentTarget.getBoundingClientRect();
        showRailTip({ label, left: r.right + 10, top: r.top + r.height / 2 });
      }}
      onMouseLeave={scheduleRailOverlayClose}
      aria-label={label}
    >
      <span className="flex items-center justify-center [&_img]:max-h-[22px] [&_img]:max-w-[22px] [&_img]:object-contain">
        {icon || <span className="text-xs font-bold">{label.charAt(0)}</span>}
      </span>
    </button>
  );
}, (prevProps, nextProps) => (
  prevProps.label === nextProps.label &&
  prevProps.selectedLabel === nextProps.selectedLabel &&
  prevProps.showRailTip === nextProps.showRailTip &&
  prevProps.scheduleRailOverlayClose === nextProps.scheduleRailOverlayClose &&
  prevProps.cancelRailOverlayClose === nextProps.cancelRailOverlayClose
));

// Flyout parent: icon-only rail — submenu opens in HubSpot-style panel to the right
const DropdownHeader = React.memo(({
  label,
  icon,
  selectedLabel,
  items,
  onItemSelect,
  showRailFlyout,
  scheduleRailOverlayClose,
  cancelRailOverlayClose
}) => {
  const currentSelectedLabel = localStorage.getItem('selectedLabel');
  const currentPath = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const loanTypeName = urlParams.get('loan_type_name');

  const hasActiveSubItem = useMemo(() => {
    const activeLabel = selectedLabel || currentSelectedLabel;

    if (activeLabel) {
      return items.some(item => item.label === activeLabel);
    }

    return items.some(item => {
      if (item.isLoanType && loanTypeName) {
        if (item.label === loanTypeName && currentPath.includes('/lead-crm')) return true;
        if (item.label === `${loanTypeName} Login` && currentPath.includes('/login-crm')) return true;
      }
      if ((item.label === 'Employees' && currentPath.includes('/employees')) ||
          (item.label === 'Attendance' && currentPath.includes('/attendance')) ||
          (item.label === 'Leave' && currentPath.includes('/leave')) ||
          (item.label === 'Daily Performance' && currentPath.includes('/performance'))) return true;
      if ((item.label === 'Warning Dashboard' && currentPath.includes('/warning/dashboard')) ||
          (item.label === 'All Warnings' && currentPath.includes('/warning/all')) ||
          (item.label === 'My Warnings' && currentPath.includes('/warning/my'))) return true;
      if (item.label === 'Transfer Requests' && currentPath.includes('/transfer-requests')) return true;
      if ((item.label === 'LEAD Dashboard' && currentPath.includes('/lead-dashboard')) ||
          (item.label === 'Create LEAD' && currentPath.includes('/create-lead'))) return true;
      return false;
    }) || (
      loanTypeName && (
        (label === 'LEAD CRM' && (currentPath.includes('/lead-crm') || currentPath.includes('/leads'))) ||
        (label === 'Login CRM' && (currentPath.includes('/login-crm') || currentPath.includes('/login')))
      )
    );
  }, [items, selectedLabel, currentSelectedLabel, currentPath, loanTypeName, label]);

  const openFlyout = useCallback((el) => {
    if (!items || items.length === 0) return;
    cancelRailOverlayClose();
    const r = el.getBoundingClientRect();
    showRailFlyout({ left: r.right + 10, top: r.top, items, label });
  }, [items, label, showRailFlyout, cancelRailOverlayClose]);

  return (
    <button
      type="button"
      className={cn(
        'flex items-center justify-center w-11 h-11 mx-auto rounded-full transition-all border border-transparent shrink-0',
        hasActiveSubItem
          ? 'bg-[#ffeb00] text-black'
          : 'text-[#00d2ff] hover:bg-white hover:text-black'
      )}
      style={hasActiveSubItem ? {
        boxShadow: '0 0 15px rgba(255,235,0,0.25), inset 0 0 8px rgba(255,235,0,0.07)',
        border: '1px solid rgba(255,235,0,0.45)',
      } : {}}
      onMouseEnter={(e) => openFlyout(e.currentTarget)}
      onMouseLeave={scheduleRailOverlayClose}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openFlyout(e.currentTarget);
      }}
      aria-label={label}
      aria-haspopup="true"
    >
      <span className="flex items-center justify-center [&_img]:max-h-[22px] [&_img]:max-w-[22px] [&_img]:object-contain">
        {icon || <span className="text-xs font-bold">{label.charAt(0)}</span>}
      </span>
    </button>
  );
});

function Sidebar({ selectedLabel: initialSelectedLabel, setSelectedLabel: parentSetSelectedLabel }) {
  // ===== STEP 1: LOAD SIDEBAR MENU DATA FROM API FIRST (v1st) =====
  const [sidebarMenuData, setSidebarMenuData] = useState(() => {
    try {
      const cached = localStorage.getItem('cachedSidebarMenuData_v1');
      return cached ? JSON.parse(cached) : {
        loanTypes: [],
        permissions: {},
        staticItems: ['Feed', 'Task', 'Ticket', 'Notifications', 'Interview Panel', 'Apps', 'Settings', 'Reports'],
        dynamicDropdowns: ['LEAD CRM', 'Login CRM', 'HRMS', 'Warning'],
        lastUpdated: null
      };
    } catch {
      return {
        loanTypes: [],
        permissions: {},
        staticItems: ['Feed', 'Task', 'Ticket', 'Notifications', 'Interview Panel', 'Apps', 'Settings', 'Reports'],
        dynamicDropdowns: ['LEAD CRM', 'Login CRM', 'HRMS', 'Warning'],
        lastUpdated: null
      };
    }
  });

  // HubSpot-style rail overlays (tooltip + flyout); fixed narrow sidebar width
  const [railTip, setRailTip] = useState(null);
  const [railFlyout, setRailFlyout] = useState(null);
  const railClearTimerRef = useRef(null);

  const [selectedLabel, setSelectedLabel] = useState(() => {
    return initialSelectedLabel || localStorage.getItem('selectedLabel') || 'Feed';
  });
  
  // Menu state derived from API data
  const [loanTypes, setLoanTypes] = useState(sidebarMenuData.loanTypes || []);
  
  // CRITICAL FIX: Load permissions IMMEDIATELY from localStorage on mount
  // This prevents the "empty permissions on first render" race condition
  const [userPermissions, setUserPermissions] = useState(() => {
    try {
      // Try to get permissions from multiple sources
      console.log('🔐 INIT: Loading initial permissions...');
      
      // Source 1: Direct localStorage read (most reliable)
      // IMPORTANT: If the key EXISTS in localStorage (even as empty {}),
      // use it EXACTLY as stored. {} means the user has 0 permissions — do
      // NOT fall through to Source 3 cache (could have old user's data).
      const directPerms = localStorage.getItem('userPermissions');
      if (directPerms !== null && directPerms !== undefined) {
        try {
          const parsed = JSON.parse(directPerms);
          console.log('✅ INIT: Loaded permissions from localStorage', Object.keys(parsed || {}).length, 'keys');
          return parsed || {};
        } catch (e) {
          console.warn('⚠️ INIT: Failed to parse userPermissions from localStorage');
        }
      }
      
      // Source 2: getUserPermissions utility (only if key absent from localStorage)
      const utilPerms = getUserPermissions();
      if (utilPerms && Object.keys(utilPerms).length > 0) {
        console.log('✅ INIT: Loaded permissions from getUserPermissions()', Object.keys(utilPerms).length, 'keys');
        return utilPerms;
      }
      
      // Source 3: Cached sidebar data (last resort when localStorage has no key at all)
      if (sidebarMenuData.permissions && Object.keys(sidebarMenuData.permissions).length > 0) {
        console.log('✅ INIT: Loaded permissions from cached sidebar data', Object.keys(sidebarMenuData.permissions).length, 'keys');
        return sidebarMenuData.permissions;
      }
      
      // STRICT: No permissions found -> empty object so nothing renders.
      console.warn('⚠️ INIT: No permissions found, denying all sidebar items');
      return {};
    } catch (error) {
      console.error('❌ INIT: Error loading initial permissions:', error);
      return {};
    }
  });
  
  const [permissionsLoaded, setPermissionsLoaded] = useState(!!sidebarMenuData.lastUpdated);
  const [menuDataLoaded, setMenuDataLoaded] = useState(!!sidebarMenuData.lastUpdated);
  
  // Dropdown state - accordion behavior (only one open at a time)
  const [openDropdowns, setOpenDropdowns] = useState(() => {
    try {
      const saved = localStorage.getItem('openDropdowns');
      return saved ? JSON.parse(saved) : {
        'LEAD CRM': false,
        'Login CRM': false,
        'HRMS': false,
        'Warning': false
      };
    } catch {
      return { 'LEAD CRM': false, 'Login CRM': false, 'HRMS': false, 'Warning': false };
    }
  });

  // Force re-render when localStorage changes to maintain highlighting
  const [forceUpdate, setForceUpdate] = useState(0);

  const { navigateToRoute } = useAppNavigation();

  // Parent-child mapping for sub-items - MOVED BEFORE useEffects
  const itemToParentMap = useMemo(() => {
    const map = {
      "LEAD Dashboard": "LEAD CRM",
      "Create LEAD": "LEAD CRM",
      "Employees": "HRMS",
      "Leave": "HRMS",
      "Attendance": "HRMS",
      "Daily Performance": "HRMS",
      "Dialer Report": "HRMS",
      "Offer Letter": "HRMS",
      "Warning Dashboard": "Warning",
      "All Warnings": "Warning",
      "My Warnings": "Warning",
      "Transfer Requests": "Login CRM",
    };
    
    // Add loan types to mapping
    loanTypes.forEach(loanType => {
      map[loanType.name] = "LEAD CRM";
      map[`${loanType.name} Login`] = "Login CRM";
    });
    
    return map;
  }, [loanTypes]);

  // Sync with parent selectedLabel prop changes
  useEffect(() => {
    if (initialSelectedLabel && initialSelectedLabel !== selectedLabel) {
      setSelectedLabel(initialSelectedLabel);
      setForceUpdate(prev => prev + 1);
    }
  }, [initialSelectedLabel, selectedLabel]);

  // Listen for localStorage changes to update highlighting and persist after render - Enhanced
  useEffect(() => {
    const handleStorageChange = () => {
      const newSelectedLabel = localStorage.getItem('selectedLabel');
      if (newSelectedLabel && newSelectedLabel !== selectedLabel) {
        setSelectedLabel(newSelectedLabel);
        if (parentSetSelectedLabel) {
          parentSetSelectedLabel(newSelectedLabel);
        }
        setForceUpdate(prev => prev + 1);
      }
    };

    // Also check for changes via custom event
    const handleLabelChange = (event) => {
      if (event.detail && event.detail.label) {
        setSelectedLabel(event.detail.label);
        if (parentSetSelectedLabel) {
          parentSetSelectedLabel(event.detail.label);
        }
        setForceUpdate(prev => prev + 1);
      }
    };

    // Enhanced component load handler - checks URL and restores state
    const handleComponentLoad = () => {
      const currentPath = window.location.pathname;
      const urlParams = new URLSearchParams(window.location.search);
      const loanTypeName = urlParams.get('loan_type_name');
      let persistedLabel = localStorage.getItem('selectedLabel');
      
      // Derive correct selection from current URL if needed
      let urlBasedLabel = null;
      if (loanTypeName) {
        if (currentPath.includes('/lead-crm') || currentPath.includes('/leads')) {
          urlBasedLabel = loanTypeName;
        } else if (currentPath.includes('/login-crm') || currentPath.includes('/login')) {
          urlBasedLabel = `${loanTypeName} Login`;
        }
      }
      else if (currentPath.includes('/employees')) {
        urlBasedLabel = 'Employees';
      }
      else if (currentPath.includes('/attendance')) {
        urlBasedLabel = 'Attendance';
      }
      else if (currentPath.includes('/leave')) {
        urlBasedLabel = 'Leave';
      }
      else if (currentPath.includes('/performance')) {
        urlBasedLabel = 'Daily Performance';
      }
      
      // Use URL-based label if it's different from persisted or if no persisted label
      const targetLabel = urlBasedLabel || persistedLabel;
      
      if (targetLabel && targetLabel !== selectedLabel) {
        localStorage.setItem('selectedLabel', targetLabel);
        setSelectedLabel(targetLabel);
        if (parentSetSelectedLabel) {
          parentSetSelectedLabel(targetLabel);
        }
        setForceUpdate(prev => prev + 1);
        
        // Store loan type specific data if applicable
        if (loanTypeName && urlBasedLabel) {
          const foundLoanType = loanTypes.find(lt => lt.name === loanTypeName);
          if (foundLoanType) {
            localStorage.setItem('selectedLoanTypeId', foundLoanType._id);
            localStorage.setItem('selectedLoanTypeName', urlBasedLabel);
            
            if (currentPath.includes('/lead-crm') || currentPath.includes('/leads')) {
              localStorage.setItem('leadCrmLoanTypeId', foundLoanType._id);
              localStorage.setItem('leadCrmLoanTypeName', urlBasedLabel);
              localStorage.setItem('lastActiveCrm', 'LEAD');
            } else if (currentPath.includes('/login-crm') || currentPath.includes('/login')) {
              localStorage.setItem('loginCrmLoanTypeId', foundLoanType._id);
              localStorage.setItem('loginCrmLoanTypeName', urlBasedLabel);
              localStorage.setItem('loginCrmCleanLoanTypeName', loanTypeName);
              localStorage.setItem('lastActiveCrm', 'LOGIN');
            }
          }
        }
        
        // Ensure dropdown is open for sub-items
        const parentDropdown = itemToParentMap[targetLabel];
        if (parentDropdown) {
          setOpenDropdowns(prev => {
            const newState = {
              'LEAD CRM': false,
              'Login CRM': false,
              'HRMS': false,
              'Warning': false,
              [parentDropdown]: true
            };
            localStorage.setItem('openDropdowns', JSON.stringify(newState));
            return newState;
          });
        }
      }
    };

    // Check for component load periodically to maintain state
    const intervalId = setInterval(handleComponentLoad, 1000);

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('selectedLabelChanged', handleLabelChange);
    window.addEventListener('DOMContentLoaded', handleComponentLoad);
    window.addEventListener('load', handleComponentLoad);
    
    // Also listen for page navigation events
    window.addEventListener('popstate', handleComponentLoad);
    window.addEventListener('pushstate', handleComponentLoad);
    window.addEventListener('replacestate', handleComponentLoad);

    // Initial check
    handleComponentLoad();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('selectedLabelChanged', handleLabelChange);
      window.removeEventListener('DOMContentLoaded', handleComponentLoad);
      window.removeEventListener('load', handleComponentLoad);
      window.removeEventListener('popstate', handleComponentLoad);
      window.removeEventListener('pushstate', handleComponentLoad);
      window.removeEventListener('replacestate', handleComponentLoad);
      clearInterval(intervalId);
    };
  }, [selectedLabel, parentSetSelectedLabel, itemToParentMap, loanTypes]);

  // Handle item selection - STATE CHANGE + HIGHLIGHT FIRST, THEN RENDER + KEEP HIGHLIGHT
  const handleSelection = useCallback((label, isLoanType = false, loanTypeId = null) => {
    // ===== STEP 1: IMMEDIATE STATE CHANGE + HIGHLIGHTING =====
    // Update localStorage FIRST for instant visual feedback
    localStorage.setItem('selectedLabel', label);
    
    // Update React state IMMEDIATELY to trigger re-render with highlighting
    setSelectedLabel(label);
    if (parentSetSelectedLabel) {
      parentSetSelectedLabel(label);
    }
    
    // Force immediate re-render to show highlighting
    setForceUpdate(prev => prev + 1);
    
    // ===== STEP 2: UPDATE DROPDOWN STATE + MAINTAIN HIGHLIGHT =====
    const parentDropdown = itemToParentMap[label];
    if (parentDropdown) {
      const newDropdownState = {
        'LEAD CRM': false,
        'Login CRM': false,
        'HRMS': false,
        'Warning': false,
        [parentDropdown]: true
      };
      localStorage.setItem('openDropdowns', JSON.stringify(newDropdownState));
      setOpenDropdowns(newDropdownState);
    } else {
      // Close all dropdowns when a non-dropdown item is selected
      const closedState = {
        'LEAD CRM': false,
        'Login CRM': false,
        'HRMS': false,
        'Warning': false
      };
      localStorage.setItem('openDropdowns', JSON.stringify(closedState));
      setOpenDropdowns(closedState);
    }
    
    // ===== STEP 3: HANDLE LOAN TYPE STATE + PERSIST HIGHLIGHT =====
    if (isLoanType && loanTypeId) {
      const isLoginCRM = label.includes(' Login');
      localStorage.setItem('selectedLoanTypeId', loanTypeId);
      localStorage.setItem('selectedLoanTypeName', label);
      
      // Ensure highlight persists for loan type selection
      localStorage.setItem('selectedLabel', label);
      
      if (isLoginCRM) {
        const baseName = label.replace(' Login', '');
        localStorage.setItem('loginCrmLoanTypeId', loanTypeId);
        localStorage.setItem('loginCrmLoanTypeName', label);
        localStorage.setItem('loginCrmCleanLoanTypeName', baseName);
        localStorage.setItem('lastActiveCrm', 'LOGIN');
      } else {
        localStorage.setItem('leadCrmLoanTypeId', loanTypeId);
        localStorage.setItem('leadCrmLoanTypeName', label);
        localStorage.setItem('lastActiveCrm', 'LEAD');
      }
    }
    
    // ===== STEP 4: DISPATCH STATE EVENTS + MAINTAIN HIGHLIGHT =====
    // Dispatch events for page content updates while maintaining highlight
    if (isLoanType && loanTypeId) {
      const isLoginCRM = label.includes(' Login');
      if (isLoginCRM) {
        const baseName = label.replace(' Login', '');
        window.dispatchEvent(new CustomEvent('loginCrmLoanTypeChanged', { 
          detail: { loanTypeId, loanTypeName: label, cleanLoanTypeName: baseName } 
        }));
      } else {
        window.dispatchEvent(new CustomEvent('leadCrmLoanTypeChanged', { 
          detail: { loanTypeId, loanTypeName: label } 
        }));
      }
      
      // Re-confirm highlight after event dispatch
      localStorage.setItem('selectedLabel', label);
    }
    
    // ===== STEP 5: RENDER PAGE CONTENT + PRESERVE HIGHLIGHT =====
    // Use requestAnimationFrame to ensure highlighting completes before navigation
    requestAnimationFrame(() => {
      // Ensure highlight is still set before navigation
      localStorage.setItem('selectedLabel', label);
      
      const route = getRouteByLabel(label);
      
      if (route) {
        // Build the full URL with query parameters for loan types
        let fullRoute = route;
        if (parentDropdown && (parentDropdown === 'LEAD CRM' || parentDropdown === 'Login CRM')) {
          let baseLoanTypeName = label;
          if (parentDropdown === 'Login CRM') {
            baseLoanTypeName = label.replace(' Login', '');
          }
          fullRoute = `${route}?loan_type_name=${encodeURIComponent(baseLoanTypeName)}`;
        }
        
        // Clear logincrm_restore so navigating back to LoginCRM shows the list, not a stale lead
        sessionStorage.removeItem('logincrm_restore');

        // When switching between loan-type sub-sections of the SAME component
        // (e.g. PL Login → BL Login), use replace so the browser back button
        // exits the component entirely rather than cycling through each loan type.
        const isSamePathname = (() => {
          try {
            const target = new URL(fullRoute, window.location.href);
            return target.pathname === window.location.pathname;
          } catch { return false; }
        })();
        
        // Navigate with the full URL (including query parameters)
        navigateToRoute(fullRoute, label, { replace: isSamePathname });
        
        // Final highlight confirmation after navigation
        setTimeout(() => {
          localStorage.setItem('selectedLabel', label);
          setSelectedLabel(label);
          if (parentSetSelectedLabel) {
            parentSetSelectedLabel(label);
          }
          // Dispatch custom event to ensure all components know about the selection
          window.dispatchEvent(new CustomEvent('selectedLabelChanged', { 
            detail: { label } 
          }));
        }, 50);
      }
    });
    
  }, [itemToParentMap, navigateToRoute, parentSetSelectedLabel]);

  const cancelRailOverlayClose = useCallback(() => {
    if (railClearTimerRef.current) {
      clearTimeout(railClearTimerRef.current);
      railClearTimerRef.current = null;
    }
  }, []);

  const scheduleRailOverlayClose = useCallback(() => {
    cancelRailOverlayClose();
    railClearTimerRef.current = setTimeout(() => {
      setRailTip(null);
      setRailFlyout(null);
    }, 160);
  }, [cancelRailOverlayClose]);

  const showRailTip = useCallback((payload) => {
    cancelRailOverlayClose();
    setRailFlyout(null);
    setRailTip(payload);
  }, [cancelRailOverlayClose]);

  const showRailFlyout = useCallback((payload) => {
    cancelRailOverlayClose();
    setRailTip(null);
    setRailFlyout(payload);
  }, [cancelRailOverlayClose]);

  const selectFromRail = useCallback((label, isLoanType = false, loanTypeId = null) => {
    cancelRailOverlayClose();
    setRailTip(null);
    setRailFlyout(null);
    handleSelection(label, isLoanType, loanTypeId);
  }, [handleSelection, cancelRailOverlayClose]);

  useEffect(() => () => {
    cancelRailOverlayClose();
  }, [cancelRailOverlayClose]);

  // ===== DEBUG: Log initial permission state on mount =====
  useEffect(() => {
    console.log('🔍 ========================================');
    console.log('🔍 SIDEBAR MOUNTED - INITIAL STATE');
    console.log('🔍 ========================================');
    console.log('🔍 userPermissions state:', userPermissions);
    console.log('🔍 userPermissions keys:', Object.keys(userPermissions || {}));
    console.log('🔍 userPermissions count:', Object.keys(userPermissions || {}).length);
    console.log('🔍 localStorage userPermissions:', localStorage.getItem('userPermissions'));
    console.log('🔍 localStorage userId:', localStorage.getItem('userId'));
    console.log('🔍 localStorage token:', localStorage.getItem('token') ? 'EXISTS' : 'MISSING');
    console.log('🔍 Is Super Admin:', isSuperAdmin(userPermissions));
    console.log('🔍 ========================================');
  }, []); // Run only once on mount

  // ⚡ IMMEDIATE PERMISSION REFRESH LISTENER
  useEffect(() => {
    console.log('👂 Setting up immediate permission refresh listener in Sidebar...');
    
    const cleanup = setupPermissionRefreshListeners((freshPermissions) => {
      console.log('🔄 Sidebar received immediate permission update:', freshPermissions);
      
      // Update permissions state immediately
      setUserPermissions(freshPermissions);
      
      // Clear sidebar cache to force refresh
      localStorage.removeItem('cachedSidebarMenuData_v1');
      
      // Force component re-render
      setForceUpdate(prev => prev + 1);
      
      console.log('✅ Sidebar permissions updated immediately');
    });

    return cleanup;
  }, []);

  // ===== API DATA LOADING - LOAD SIDEBAR DATA FIRST =====
  useEffect(() => {
    const loadAllSidebarData = async () => {
      try {
        console.log('🔄 ========================================');
        console.log('🔄 SIDEBAR DATA LOADING START');
        console.log('🔄 ========================================');
        const userId = localStorage.getItem('userId') || '';
        const token = localStorage.getItem('token') || '';
        
        // CRITICAL: Load permissions FIRST before anything else
        console.log('🔄 Step 1: Loading permissions from localStorage...');
        let loadedPermissions;
        try {
          loadedPermissions = getUserPermissions();
          console.log('📋 Raw permissions from localStorage:', loadedPermissions);
          console.log('📋 Permissions type:', typeof loadedPermissions);
          console.log('📋 Permissions keys:', Object.keys(loadedPermissions || {}));
          console.log('📋 Is empty?', Object.keys(loadedPermissions || {}).length === 0);
          
          // If permissions are empty, try to read directly from localStorage
          if (!loadedPermissions || Object.keys(loadedPermissions).length === 0) {
            console.warn('⚠️ getUserPermissions() returned empty, trying direct localStorage read...');
            const directRead = localStorage.getItem('userPermissions');
            console.log('📋 Direct localStorage read:', directRead);
            if (directRead) {
              try {
                loadedPermissions = JSON.parse(directRead);
                console.log('✅ Parsed permissions from direct read:', loadedPermissions);
              } catch (parseError) {
                console.error('❌ Failed to parse permissions:', parseError);
              }
            }
          }
          
          // STRICT: If still empty, leave empty so nothing shows in sidebar
          if (!loadedPermissions || Object.keys(loadedPermissions).length === 0) {
            console.warn('⚠️ No permissions found - sidebar will be empty');
            loadedPermissions = {};
          }
          
          console.log('✅ Final loaded permissions:', loadedPermissions);
        } catch (error) {
          console.error('❌ Error loading permissions:', error);
          loadedPermissions = {};
        }
        
        // Set permissions IMMEDIATELY before any other operations
        console.log('🔄 Step 2: Setting permissions state...');
        setUserPermissions(loadedPermissions);
        setPermissionsLoaded(true);
        console.log('✅ Permissions set and marked as loaded');
        
        // Load all sidebar-related data in parallel
        console.log('🔄 Step 3: Loading loan types...');
        const [permissionsResponse, loanTypesResponse] = await Promise.all([
          // Return already loaded permissions
          Promise.resolve(loadedPermissions),
          
          // Load loan types (trailing slash required to avoid redirect)
          fetch(`${API_BASE_URL}/loan-types/?user_id=${userId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            }
          }).then(res => {
            if (res.ok) {
              return res.json();
            }
            throw new Error('Failed to fetch loan types');
          })
          .catch((error) => {
            console.error('❌ Sidebar: Error loading loan types:', error);
            // Fallback to cached data
            const cached = localStorage.getItem('cachedLoanTypes');
            return cached ? JSON.parse(cached) : { items: [] };
          })
        ]);
        
        const loanTypesData = loanTypesResponse.items || loanTypesResponse.loan_types || loanTypesResponse || [];
        
        console.log('📊 Sidebar: Loan types loaded:', loanTypesData.length);
        
        // ===== STEP 4: STORE COMPLETE SIDEBAR DATA =====
        console.log('🔄 Step 4: Caching sidebar data...');
        const completeMenuData = {
          loanTypes: loanTypesData,
          permissions: permissionsResponse,
          staticItems: ['Feed', 'Task', 'Ticket', 'Notifications', 'Interview Panel', 'Apps', 'Settings', 'Reports'],
          dynamicDropdowns: ['LEAD CRM', 'Login CRM', 'HRMS', 'Warning'],
          lastUpdated: Date.now()
        };
        
        // Cache the complete data structure
        localStorage.setItem('cachedSidebarMenuData_v1', JSON.stringify(completeMenuData));
        localStorage.setItem('cachedLoanTypes', JSON.stringify(loanTypesData));
        
        console.log('✅ Sidebar: Data cached successfully');
        
        // ===== STEP 5: UPDATE STATE WITH LOADED DATA =====
        console.log('🔄 Step 5: Updating state...');
        setSidebarMenuData(completeMenuData);
        setLoanTypes(loanTypesData);
        // Permissions already set earlier
        setMenuDataLoaded(true);
        
        console.log('✅ ========================================');
        console.log('✅ SIDEBAR DATA LOADING COMPLETE');
        console.log('✅ Permissions loaded:', Object.keys(permissionsResponse).length, 'keys');
        console.log('✅ Loan types loaded:', loanTypesData.length, 'items');
        console.log('✅ ========================================');
        
      } catch (error) {
        console.error('❌ ========================================');
        console.error('❌ SIDEBAR DATA LOADING ERROR');
        console.error('❌ ========================================');
        console.error('❌ Error details:', error);
        
        // Fallback to cached data
        try {
          console.log('📦 Attempting to load cached data...');
          const cached = localStorage.getItem('cachedSidebarMenuData_v1');
          if (cached) {
            console.log('📦 Cached data found, parsing...');
            const cachedData = JSON.parse(cached);
            setSidebarMenuData(cachedData);
            setLoanTypes(cachedData.loanTypes || []);
            
            // Only set permissions if not already set
            if (!permissionsLoaded) {
              const cachedPerms = cachedData.permissions || {};
              console.log('📦 Using cached permissions:', cachedPerms);
              setUserPermissions(cachedPerms);
              setPermissionsLoaded(true);
            }
            console.log('✅ Cached data loaded successfully');
          } else {
            console.warn('⚠️ No cached data available - sidebar will be empty until permissions load');
            if (!permissionsLoaded) {
              setUserPermissions({});
              setPermissionsLoaded(true);
            }
          }
        } catch (cacheError) {
          console.error('❌ Error loading cached data:', cacheError);
          // STRICT: deny by default on error
          if (!permissionsLoaded) {
            console.log('📦 No fallback - denying all permissions');
            setUserPermissions({});
            setPermissionsLoaded(true);
          }
          setLoanTypes([]);
        }
        
        setMenuDataLoaded(true);
        console.log('❌ ========================================');
      }
    };

    loadAllSidebarData();
  }, []);

  // Handle URL parameters and path-based selection restoration - Enhanced for async loan types
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const loanTypeName = urlParams.get('loan_type_name');
    const currentPath = window.location.pathname;
    
    let targetLabel = null;
    let parentDropdown = null;
    
    // Check for loan type in URL - Enhanced to work even without loaded loan types
    if (loanTypeName) {
      // Store loan type data for later use when loan types are loaded
      localStorage.setItem('pendingLoanTypeRestore', loanTypeName);
      
      if (currentPath.includes('/lead-crm') || currentPath.includes('/leads')) {
        targetLabel = loanTypeName;
        parentDropdown = 'LEAD CRM';
      } else if (currentPath.includes('/login-crm') || currentPath.includes('/login')) {
        targetLabel = `${loanTypeName} Login`;
        parentDropdown = 'Login CRM';
      }
    }
    
    // Check for HRMS pages
    else if (currentPath.includes('/employees') || currentPath.includes('/hrms/employees')) {
      targetLabel = 'Employees';
      parentDropdown = 'HRMS';
    }
    else if (currentPath.includes('/attendance') || currentPath.includes('/hrms/attendance')) {
      targetLabel = 'Attendance';
      parentDropdown = 'HRMS';
    }
    else if (currentPath.includes('/leave') || currentPath.includes('/hrms/leave')) {
      targetLabel = 'Leave';
      parentDropdown = 'HRMS';
    }
    else if (currentPath.includes('/performance') || currentPath.includes('/hrms/performance')) {
      targetLabel = 'Daily Performance';
      parentDropdown = 'HRMS';
    }
    else if (currentPath.includes('/dialer-report') || currentPath.includes('/hrms/dialer-report')) {
      targetLabel = 'Dialer Report';
      parentDropdown = 'HRMS';
    }
    
    // Check for Warning pages
    else if (currentPath.includes('/warning/dashboard')) {
      targetLabel = 'Warning Dashboard';
      parentDropdown = 'Warning';
    }
    else if (currentPath.includes('/warning/all') || currentPath.includes('/warnings/all')) {
      targetLabel = 'All Warnings';
      parentDropdown = 'Warning';
    }
    else if (currentPath.includes('/warning/my') || currentPath.includes('/warnings/my')) {
      // Only set My Warnings for non-super admin users
      if (!isSuperAdmin(userPermissions)) {
        targetLabel = 'My Warnings';
        parentDropdown = 'Warning';
      } else {
        // Redirect super admin to All Warnings instead
        targetLabel = 'All Warnings';
        parentDropdown = 'Warning';
      }
    }
    
    // Check for Transfer Requests
    else if (currentPath.includes('/transfer-requests')) {
      targetLabel = 'Transfer Requests';
      parentDropdown = 'Login CRM';
    }
    // Check for other main pages
    else if (currentPath.includes('/lead-dashboard') || currentPath.includes('/crm-dashboard')) {
      targetLabel = 'LEAD Dashboard';
      parentDropdown = 'LEAD CRM';
    }
    else if (currentPath.includes('/create-lead')) {
      targetLabel = 'Create LEAD';
      parentDropdown = 'LEAD CRM';
    }
    else if (currentPath.includes('/feed') || currentPath === '/') {
      targetLabel = 'Feed';
    }
    else if (currentPath === '/dashboard') {
      targetLabel = 'Dashboard';
    }
    else if (currentPath.includes('/task')) {
      targetLabel = 'Task';
    }
    else if (currentPath.includes('/ticket')) {
      targetLabel = 'Ticket';
    }
    else if (currentPath.includes('/notification')) {
      targetLabel = 'Announcement';
    }
    else if (currentPath.includes('/app')) {
      targetLabel = 'Apps';
    }
    else if (currentPath.includes('/setting')) {
      targetLabel = 'Settings';
    }
    else if (currentPath.includes('/report')) {
      targetLabel = 'Reports';
    }
    else if (currentPath.includes('/offer-letter')) {
      targetLabel = 'Offer Letter';
    }
    
    // Apply the selection if found
    if (targetLabel) {
      
      localStorage.setItem('selectedLabel', targetLabel);
      setSelectedLabel(targetLabel);
      if (parentSetSelectedLabel) {
        parentSetSelectedLabel(targetLabel);
      }
      
      // Store loan type info if it's a loan type
      if (loanTypeName && targetLabel) {
        localStorage.setItem('selectedLoanTypeName', targetLabel);
        
        if (parentDropdown === 'LEAD CRM') {
          localStorage.setItem('leadCrmLoanTypeName', targetLabel);
          localStorage.setItem('lastActiveCrm', 'LEAD');
        } else if (parentDropdown === 'Login CRM') {
          const baseName = loanTypeName;
          localStorage.setItem('loginCrmLoanTypeName', targetLabel);
          localStorage.setItem('loginCrmCleanLoanTypeName', baseName);
          localStorage.setItem('lastActiveCrm', 'LOGIN');
        }
      }
      
      // Open parent dropdown if needed
      if (parentDropdown) {
        setOpenDropdowns(prev => {
          const newState = {
            'LEAD CRM': false,
            'Login CRM': false,
            'HRMS': false,
            'Warning': false,
            [parentDropdown]: true
          };
          localStorage.setItem('openDropdowns', JSON.stringify(newState));
          return newState;
        });
      }
      
      // Force re-render to show selection
      setForceUpdate(prev => prev + 1);
    }
  }, [parentSetSelectedLabel]); // Removed loanTypes dependency to run even when loan types not loaded

  // Additional effect to handle loan type restoration once loan types are loaded
  useEffect(() => {
    if (loanTypes.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const loanTypeName = urlParams.get('loan_type_name');
      const currentPath = window.location.pathname;
      const currentSelectedLabel = localStorage.getItem('selectedLabel');
      
      if (loanTypeName) {
        let expectedLabel = null;
        let parentDropdown = null;
        let loanTypeId = null;
        
        // Find the loan type ID
        const foundLoanType = loanTypes.find(lt => lt.name === loanTypeName);
        if (foundLoanType) {
          loanTypeId = foundLoanType._id;
        }
        
        if (currentPath.includes('/lead-crm') || currentPath.includes('/leads')) {
          expectedLabel = loanTypeName;
          parentDropdown = 'LEAD CRM';
        } else if (currentPath.includes('/login-crm') || currentPath.includes('/login')) {
          expectedLabel = `${loanTypeName} Login`;
          parentDropdown = 'Login CRM';
        }
        
        // Only update if the current selection doesn't match the expected loan type
        if (expectedLabel && currentSelectedLabel !== expectedLabel) {
          
          localStorage.setItem('selectedLabel', expectedLabel);
          setSelectedLabel(expectedLabel);
          if (parentSetSelectedLabel) {
            parentSetSelectedLabel(expectedLabel);
          }
          
          // Store loan type specific data
          if (loanTypeId) {
            localStorage.setItem('selectedLoanTypeId', loanTypeId);
            localStorage.setItem('selectedLoanTypeName', expectedLabel);
            
            if (parentDropdown === 'LEAD CRM') {
              localStorage.setItem('leadCrmLoanTypeId', loanTypeId);
              localStorage.setItem('leadCrmLoanTypeName', expectedLabel);
              localStorage.setItem('lastActiveCrm', 'LEAD');
            } else if (parentDropdown === 'Login CRM') {
              const baseName = loanTypeName;
              localStorage.setItem('loginCrmLoanTypeId', loanTypeId);
              localStorage.setItem('loginCrmLoanTypeName', expectedLabel);
              localStorage.setItem('loginCrmCleanLoanTypeName', baseName);
              localStorage.setItem('lastActiveCrm', 'LOGIN');
            }
          }
          
          // Ensure parent dropdown is open
          if (parentDropdown) {
            setOpenDropdowns(prev => {
              const newState = {
                'LEAD CRM': false,
                'Login CRM': false,
                'HRMS': false,
                'Warning': false,
                [parentDropdown]: true
              };
              localStorage.setItem('openDropdowns', JSON.stringify(newState));
              return newState;
            });
          }
          
          setForceUpdate(prev => prev + 1);
        }
      }
    }
  }, [loanTypes, parentSetSelectedLabel]);

  // Initialize dropdown state based on selected label and URL - Enhanced
  useEffect(() => {
    const currentPath = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const loanTypeName = urlParams.get('loan_type_name');
    
    // Determine which dropdown should be open based on current context
    let shouldOpenDropdown = null;
    
    // Check URL patterns to determine dropdown
    if (loanTypeName && (currentPath.includes('/lead-crm') || currentPath.includes('/leads'))) {
      shouldOpenDropdown = 'LEAD CRM';
    }
    else if (loanTypeName && (currentPath.includes('/login-crm') || currentPath.includes('/login'))) {
      shouldOpenDropdown = 'Login CRM';
    }
    else if (currentPath.includes('/employees') || currentPath.includes('/attendance') || 
             currentPath.includes('/leave') || currentPath.includes('/performance') ||
             currentPath.includes('/hrms')) {
      shouldOpenDropdown = 'HRMS';
    }
    else if (currentPath.includes('/warning')) {
      shouldOpenDropdown = 'Warning';
    }
    else if (currentPath.includes('/transfer-requests')) {
      shouldOpenDropdown = 'Login CRM';
    }
    else if (currentPath.includes('/lead-dashboard') || currentPath.includes('/create-lead')) {
      shouldOpenDropdown = 'LEAD CRM';
    }
    
    // selectedLabel takes highest priority - overrides URL-based detection
    const parentDropdown = itemToParentMap[selectedLabel];
    if (parentDropdown) {
      // Sub-item selected → open its parent dropdown
      shouldOpenDropdown = parentDropdown;
    } else if (selectedLabel) {
      // Regular (non-dropdown) item selected → close all dropdowns
      setOpenDropdowns(prev => {
        if (!Object.values(prev).some(v => v)) return prev; // Already all closed
        const closedState = { 'LEAD CRM': false, 'Login CRM': false, 'HRMS': false, 'Warning': false };
        localStorage.setItem('openDropdowns', JSON.stringify(closedState));
        return closedState;
      });
      return; // Skip URL-based logic
    }
    
    if (shouldOpenDropdown) {
      setOpenDropdowns(prev => {
        if (prev[shouldOpenDropdown]) return prev; // Already open
        
        const newState = {
          'LEAD CRM': false,
          'Login CRM': false,
          'HRMS': false,
          'Warning': false,
          [shouldOpenDropdown]: true
        };
        localStorage.setItem('openDropdowns', JSON.stringify(newState));
        return newState;
      });
    }
  }, [selectedLabel, itemToParentMap]);

  // Restore selected state on component mount and ensure persistence - Enhanced for sub-options
  useEffect(() => {
    const restoreSelectedState = () => {
      // First, try to get from localStorage
      let persistedLabel = localStorage.getItem('selectedLabel');
      const currentPath = window.location.pathname;
      const urlParams = new URLSearchParams(window.location.search);
      const loanTypeName = urlParams.get('loan_type_name');
      
      // If no persisted label or if URL suggests different selection, derive from URL
      if (!persistedLabel || 
          (loanTypeName && !persistedLabel.includes(loanTypeName)) ||
          (currentPath.includes('/employees') && persistedLabel !== 'Employees') ||
          (currentPath.includes('/attendance') && persistedLabel !== 'Attendance') ||
          (currentPath.includes('/leave') && persistedLabel !== 'Leave') ||
          (currentPath.includes('/performance') && persistedLabel !== 'Daily Performance')) {
        
        // Derive selection from URL path
        if (loanTypeName) {
          if (currentPath.includes('/lead-crm') || currentPath.includes('/leads')) {
            persistedLabel = loanTypeName;
          } else if (currentPath.includes('/login-crm') || currentPath.includes('/login')) {
            persistedLabel = `${loanTypeName} Login`;
          }
        }
        else if (currentPath.includes('/employees')) {
          persistedLabel = 'Employees';
        }
        else if (currentPath.includes('/attendance')) {
          persistedLabel = 'Attendance';
        }
        else if (currentPath.includes('/leave')) {
          persistedLabel = 'Leave';
        }
        else if (currentPath.includes('/performance')) {
          persistedLabel = 'Daily Performance';
        }
        else if (currentPath.includes('/transfer-requests')) {
          persistedLabel = 'Transfer Requests';
        }
        else if (currentPath.includes('/warning/dashboard')) {
          persistedLabel = 'Warning Dashboard';
        }
        else if (currentPath.includes('/warning/all')) {
          persistedLabel = 'All Warnings';
        }
        else if (currentPath.includes('/warning/my')) {
          persistedLabel = 'My Warnings';
        }
        else if (currentPath.includes('/lead-dashboard')) {
          persistedLabel = 'LEAD Dashboard';
        }
        else if (currentPath.includes('/create-lead')) {
          persistedLabel = 'Create LEAD';
        }
        
        // Update localStorage with the derived selection
        if (persistedLabel) {
          localStorage.setItem('selectedLabel', persistedLabel);
        }
      }
      
      if (persistedLabel) {
        setSelectedLabel(persistedLabel);
        if (parentSetSelectedLabel) {
          parentSetSelectedLabel(persistedLabel);
        }
        
        // Store loan type specific data if it's a loan type
        if (loanTypeName && persistedLabel && loanTypes.length > 0) {
          const foundLoanType = loanTypes.find(lt => lt.name === loanTypeName);
          if (foundLoanType) {
            localStorage.setItem('selectedLoanTypeId', foundLoanType._id);
            localStorage.setItem('selectedLoanTypeName', persistedLabel);
            
            if (currentPath.includes('/lead-crm') || currentPath.includes('/leads')) {
              localStorage.setItem('leadCrmLoanTypeId', foundLoanType._id);
              localStorage.setItem('leadCrmLoanTypeName', persistedLabel);
              localStorage.setItem('lastActiveCrm', 'LEAD');
            } else if (currentPath.includes('/login-crm') || currentPath.includes('/login')) {
              localStorage.setItem('loginCrmLoanTypeId', foundLoanType._id);
              localStorage.setItem('loginCrmLoanTypeName', persistedLabel);
              localStorage.setItem('loginCrmCleanLoanTypeName', loanTypeName);
              localStorage.setItem('lastActiveCrm', 'LOGIN');
            }
          }
        }
        
        // Ensure dropdown is open for sub-items
        const parentDropdown = itemToParentMap[persistedLabel];
        if (parentDropdown) {
          setOpenDropdowns(prev => {
            const newState = {
              'LEAD CRM': false,
              'Login CRM': false,
              'HRMS': false,
              'Warning': false,
              [parentDropdown]: true
            };
            localStorage.setItem('openDropdowns', JSON.stringify(newState));
            return newState;
          });
        }
        
        setForceUpdate(prev => prev + 1);
      }
    };

    // Restore state immediately
    restoreSelectedState();
    
    // Also restore after a short delay to handle async component loading
    const timeoutId = setTimeout(restoreSelectedState, 100);
    
    // Listen for page visibility changes (when user comes back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        restoreSelectedState();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [itemToParentMap, parentSetSelectedLabel, loanTypes]);

  // Permission check helper - STRICT: only grants access when explicitly permitted
  const checkPermission = useCallback((page, action) => {
    try {
      if (!userPermissions || Object.keys(userPermissions).length === 0) {
        // No permissions loaded / assigned -> deny everything.
        // Sidebar items must NOT show by default for any role.
        return false;
      }
      
      // Check if user is super admin first - highest priority
      if (isSuperAdmin(userPermissions)) {
        console.log(`✅ Super admin access granted for ${page}.${action}`);
        return true;
      }
      
      // Check for global wildcard
      if (userPermissions['*'] === '*' || userPermissions['*'] === true) {
        console.log(`✅ Global wildcard access for ${page}.${action}`);
        return true;
      }
      
      // Try different page name variations (case-insensitive)
      const pageVariations = [
        page,
        page.toLowerCase(),
        page.toUpperCase(),
        page.charAt(0).toUpperCase() + page.slice(1).toLowerCase()
      ];
      
      for (const pageVar of pageVariations) {
        // Check wildcard for this page
        if (userPermissions[pageVar] === '*' || userPermissions[pageVar] === true) {
          console.log(`✅ Page wildcard access for ${page}.${action} (variant: ${pageVar})`);
          return true;
        }
        
        // Check object-based permissions
        if (userPermissions[pageVar] && typeof userPermissions[pageVar] === 'object') {
          // Check specific action
          if (userPermissions[pageVar][action] === true) {
            console.log(`✅ Specific permission granted for ${page}.${action}`);
            return true;
          }
          
          // Check wildcard in object
          if (userPermissions[pageVar]['*'] === true || userPermissions[pageVar]['*'] === '*') {
            console.log(`✅ Object wildcard access for ${page}.${action}`);
            return true;
          }
          
          // REMOVED LENIENT CHECK - Now properly validates permissions
          // Old code was too permissive and allowed access even with empty permissions
        }
        
        // Check array-based permissions - MOVED BEFORE lenient check
        if (Array.isArray(userPermissions[pageVar])) {
          // CRITICAL: Empty array means NO permissions - should return false
          if (userPermissions[pageVar].length === 0) {
            console.log(`❌ Empty permission array for ${page}.${action} - access denied`);
            return false;
          }
          
          if (userPermissions[pageVar].includes(action) || userPermissions[pageVar].includes('*')) {
            console.log(`✅ Array permission granted for ${page}.${action}`);
            return true;
          }
        }
      }
      
      // Try standard hasPermission utility as final check
      if (hasPermission(userPermissions, page, action)) {
        console.log(`✅ Standard hasPermission check passed for ${page}.${action}`);
        return true;
      }
      
      // STRICT: no fallbacks. If permission is not explicitly granted, deny.
      console.log(`❌ No permission found for ${page}.${action}`);
      return false;
    } catch (error) {
      console.error(`❌ Error checking permission for ${page}.${action}:`, error);
      // STRICT: deny on error so nothing leaks into sidebar without permission
      return false;
    }
  }, [userPermissions]);

  // Memoized permission checks for better performance - Enhanced with multiple checks and logging
  /**
   * hasAnyAccess: returns true if user has ANY action for a module.
   * This ensures that view_team / view_all / delete / etc. permissions also
   * show the module in the sidebar even when 'show' is not explicitly set.
   */
  const hasAnyAccess = useCallback((page) => {
    if (!userPermissions) return false;
    if (isSuperAdmin(userPermissions)) return true;
    const variations = [
      page,
      page.toLowerCase(),
      page.toUpperCase(),
      page.charAt(0).toUpperCase() + page.slice(1).toLowerCase()
    ];
    for (const v of variations) {
      const p = userPermissions[v];
      if (!p) continue;
      if (p === '*' || p === true) return true;
      if (typeof p === 'object' && !Array.isArray(p) && Object.values(p).some(val => val === true)) return true;
      if (Array.isArray(p) && p.length > 0) return true;
    }
    return false;
  }, [userPermissions]);

  const permissions = useMemo(() => {
    console.log('🔐 ========================================');
    console.log('🔐 SIDEBAR PERMISSION CALCULATION START');
    console.log('🔐 ========================================');
    console.log('🔐 User Permissions Object:', userPermissions);
    console.log('🔐 Is Super Admin:', isSuperAdmin(userPermissions));
    console.log('🔐 ========================================');
    
    const perms = {
      // STRICT POLICY: Sidebar visibility is controlled ONLY by the explicit
      // `show` action ("Show in Sidebar" checkbox in RoleSettings). Other
      // actions like view_team/view_all/delete/create grant page-level access
      // but do NOT make the item appear in the sidebar. Super admins always
      // see everything.

      // LEAD CRM: Show if user has nested show permission OR legacy flat leads.show
      // Many existing roles still have: leads:[show,...] + leads.pl_odd_leads:[assign,status_update]
      // (without a show action on the nested entry). We must support both formats.
      canShowLeads: isSuperAdmin(userPermissions) ||
                    checkPermission('leads.create_lead', 'show') ||
                    checkPermission('leads.pl_odd_leads', 'show') ||
                    checkPermission('leads', 'show'),

      // Feed
      canShowFeeds: isSuperAdmin(userPermissions) ||
                    checkPermission('feeds', 'show') ||
                    checkPermission('Feeds', 'show'),

      // Tasks
      canShowTasks: isSuperAdmin(userPermissions) ||
                    checkPermission('tasks', 'show') ||
                    checkPermission('Tasks', 'show') ||
                    checkPermission('task', 'show'),

      // Tickets
      canShowTickets: isSuperAdmin(userPermissions) ||
                      checkPermission('tickets', 'show') ||
                      checkPermission('Tickets', 'show') ||
                      checkPermission('ticket', 'show'),

      // HRMS parent - visible if ANY HRMS sub-module's `show` is granted
      canShowHRMS: isSuperAdmin(userPermissions) ||
                   checkPermission('employees', 'show') ||
                   checkPermission('Employees', 'show') ||
                   checkPermission('attendance', 'show') ||
                   checkPermission('Attendance', 'show') ||
                   checkPermission('leaves', 'show') ||
                   checkPermission('Leaves', 'show') ||
                   checkPermission('leave', 'show') ||
                   checkPermission('offer_letter', 'show') ||
                   checkPermission('Offer Letter', 'show') ||
                   checkPermission('offerLetter', 'show') ||
                   checkPermission('dialer_report', 'show'),

      // Employees
      canShowEmployees: isSuperAdmin(userPermissions) ||
                        checkPermission('employees', 'show') ||
                        checkPermission('Employees', 'show'),

      // Dialer Report
      canShowDialerReport: isSuperAdmin(userPermissions) ||
                           checkPermission('dialer_report', 'show'),

      // Apps
      canShowApps: isSuperAdmin(userPermissions) ||
                   checkPermission('apps', 'show') ||
                   checkPermission('Apps', 'show'),

      // Settings
      canShowSettings: isSuperAdmin(userPermissions) ||
                       checkPermission('settings', 'show') ||
                       checkPermission('Settings', 'show'),

      // Login CRM
      canViewLoginCRM: isSuperAdmin(userPermissions) ||
                       checkPermission('login', 'show') ||
                       checkPermission('Login', 'show') ||
                       checkPermission('logins', 'show'),

      // Interview Panel
      canViewInterviewPanel: isSuperAdmin(userPermissions) ||
                             checkPermission('interview', 'show') ||
                             checkPermission('Interview', 'show') ||
                             checkPermission('interviews', 'show'),

      // Reports
      canViewReports: isSuperAdmin(userPermissions) ||
                      checkPermission('reports', 'show') ||
                      checkPermission('Reports', 'show') ||
                      checkPermission('report', 'show'),

      // Notifications / Announcement
      canViewNotifications: isSuperAdmin(userPermissions) ||
                            checkPermission('notification', 'show') ||
                            checkPermission('notifications', 'show') ||
                            checkPermission('Notifications', 'show') ||
                            checkPermission('announcement', 'show') ||
                            checkPermission('Announcement', 'show'),

      // Warnings
      canShowWarnings: isSuperAdmin(userPermissions) ||
                       checkPermission('warnings', 'show') ||
                       checkPermission('Warnings', 'show') ||
                       checkPermission('warning', 'show'),

      // Attendance
      canShowAttendance: isSuperAdmin(userPermissions) ||
                         checkPermission('attendance', 'show') ||
                         checkPermission('Attendance', 'show'),

      // Leaves
      canShowLeaves: isSuperAdmin(userPermissions) ||
                     checkPermission('leaves', 'show') ||
                     checkPermission('Leaves', 'show') ||
                     checkPermission('leave', 'show'),

      // Offer Letter
      canShowOfferLetter: isSuperAdmin(userPermissions) ||
                          checkPermission('offer_letter', 'show') ||
                          checkPermission('Offer Letter', 'show') ||
                          checkPermission('offerLetter', 'show'),

      // Dashboard
      canShowDashboard: isSuperAdmin(userPermissions) ||
                        checkPermission('dashboard', 'show') ||
                        checkPermission('Dashboard', 'show')
    };
    
    console.log('🔐 ========================================');
    console.log('🔐 CALCULATED PERMISSIONS:');
    console.log('🔐 ========================================');
    Object.entries(perms).forEach(([key, value]) => {
      const icon = value ? '✅' : '❌';
      console.log(`${icon} ${key}: ${value}`);
    });
    console.log('🔐 ========================================');
    console.log('🔐 SIDEBAR PERMISSION CALCULATION END');
    console.log('🔐 ========================================');
    
    return perms;
  }, [checkPermission, hasAnyAccess, userPermissions]);

  // Memoize loan type menu items to prevent flickering on selection changes
  const leadCrmLoanTypeItems = useMemo(() => {
    return loanTypes.map(loanType => ({
      label: loanType.name,
      icon: icons["PL & ODD LEADS"],
      id: loanType._id,
      isLoanType: true
    }));
  }, [loanTypes]);

  const loginCrmLoanTypeItems = useMemo(() => {
    return [
      ...loanTypes.map(loanType => ({
        label: `${loanType.name} Login`,
        icon: icons["PL & ODD LEADS"],
        id: loanType._id,
        isLoanType: true
      }))
    ];
  }, [loanTypes]);

  // Sidebar scroll-arrow visibility — must stay above any early return (Rules of Hooks)
  const navRef = useRef(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScrollState = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    checkScrollState();
    el.addEventListener('scroll', checkScrollState, { passive: true });
    const ro = new ResizeObserver(checkScrollState);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScrollState); ro.disconnect(); };
  }, [checkScrollState, permissionsLoaded, menuDataLoaded]);

  if (!permissionsLoaded || !menuDataLoaded) {
    return (
      <div className="h-screen w-[72px] bg-black border-r border-[#1f1f1f] flex items-center justify-center">
        <div className="text-[#00d2ff] text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-[62px] relative z-10 bg-black border-r border-white/[0.08] shadow-2xl shrink-0"
    >
      <style>{`
        #sidebar-nav::-webkit-scrollbar { display: none; }
      `}</style>
      <div className="flex flex-col h-full relative z-50">
        {/* Header — FYF brand text */}
        <div className="flex flex-col items-center flex-shrink-0 pt-3 pb-2 border-b border-white/[0.08] gap-0.5 px-1">
          <span className="text-[#ffeb00] font-black text-[11px] leading-none tracking-tight select-none">Fix</span>
          <span className="text-[#00d2ff] font-black text-[10px] leading-none tracking-tight select-none">Finance</span>
        </div>

        {/* Up arrow */}
        {canScrollUp && (
          <button
            type="button"
            aria-label="Scroll up"
            className="flex items-center justify-center w-full py-0.5 text-white/40 hover:text-white/80 transition-colors shrink-0"
            onClick={() => navRef.current?.scrollBy({ top: -80, behavior: 'smooth' })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}

        {/* Navigation */}
        <div
          id="sidebar-nav"
          ref={navRef}
          className="flex-1 px-1 py-1 overflow-y-auto overflow-x-hidden touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <nav className="flex flex-col gap-1 touch-manipulation items-center"
               style={{ touchAction: 'pan-y' }}>
            {/* Feed */}
            {permissions.canShowFeeds && (
            <MenuItem 
              icon={icons["Feed"]} 
              label="Feed" 
              selectedLabel={selectedLabel} 
              onSelect={selectFromRail}
              showRailTip={showRailTip}
              scheduleRailOverlayClose={scheduleRailOverlayClose}
              cancelRailOverlayClose={cancelRailOverlayClose} 
            />
            )}

            {/* Dashboard */}
            {permissions.canShowDashboard && (
              <MenuItem
                icon={icons["Dashboard"]}
                label="Dashboard"
                selectedLabel={selectedLabel}
                onSelect={selectFromRail}
                showRailTip={showRailTip}
                scheduleRailOverlayClose={scheduleRailOverlayClose}
                cancelRailOverlayClose={cancelRailOverlayClose}
              />
            )}

            {/* LEAD CRM Dropdown */}
            {permissions.canShowLeads && (
              <DropdownHeader
                label="LEAD CRM"
                icon={icons["LEAD CRM"]}
                selectedLabel={selectedLabel}
                showRailFlyout={showRailFlyout}
                scheduleRailOverlayClose={scheduleRailOverlayClose}
                cancelRailOverlayClose={cancelRailOverlayClose}
                items={[
                  // Only show "Create LEAD" if user has permission for leads.create_lead.show
                  // Priority: Check nested permission first, only use unified if nested doesn't exist
                  ...(() => {
                    const hasNestedCreateLead = checkPermission('leads.create_lead', 'show');
                    const hasNestedPlOdd = checkPermission('leads.pl_&_odd_leads', 'show') || checkPermission('leads.pl_odd_leads', 'show');
                    const hasUnified = checkPermission('leads', 'show');
                    
                    // If ANY nested permission exists, use nested logic (don't fallback to unified)
                    const hasAnyNested = hasNestedCreateLead || hasNestedPlOdd;
                    
                    // Show Create LEAD if: nested permission exists OR (no nested exists AND has unified)
                    const showCreateLead = hasNestedCreateLead || (!hasAnyNested && hasUnified);
                    
                    return showCreateLead ? [{ label: "Create LEAD", icon: icons["Create LEAD"] }] : [];
                  })(),
                  // Only show loan types if user has permission for leads.pl_&_odd_leads.show
                  ...(() => {
                    const hasNestedCreateLead = checkPermission('leads.create_lead', 'show');
                    const hasNestedPlOdd = checkPermission('leads.pl_&_odd_leads', 'show') || checkPermission('leads.pl_odd_leads', 'show');
                    const hasUnified = checkPermission('leads', 'show');
                    
                    // If ANY nested permission exists, use nested logic (don't fallback to unified)
                    const hasAnyNested = hasNestedCreateLead || hasNestedPlOdd;
                    
                    // Show PL & ODD LEADS if: nested permission exists OR (no nested exists AND has unified)
                    const showPlOdd = hasNestedPlOdd || (!hasAnyNested && hasUnified);
                    
                    return showPlOdd ? leadCrmLoanTypeItems : [];
                  })()
                ]}
                onItemSelect={selectFromRail}
              />
            )}

            {/* Login CRM Dropdown */}
            {permissions.canViewLoginCRM && (
              <DropdownHeader
                label="Login CRM"
                icon={icons["Login CRM"]}
                selectedLabel={selectedLabel}
                showRailFlyout={showRailFlyout}
                scheduleRailOverlayClose={scheduleRailOverlayClose}
                cancelRailOverlayClose={cancelRailOverlayClose}
                items={loginCrmLoanTypeItems}
                onItemSelect={selectFromRail}
              />
            )}

            {/* Task */}
            {permissions.canShowTasks && (
              <MenuItem 
                icon={icons["Task"]} 
                label="Task" 
                selectedLabel={selectedLabel} 
                onSelect={selectFromRail}
                showRailTip={showRailTip}
                scheduleRailOverlayClose={scheduleRailOverlayClose}
                cancelRailOverlayClose={cancelRailOverlayClose} 
              />
            )}

            {/* Ticket */}
            {permissions.canShowTickets && (
              <MenuItem 
                icon={icons["Ticket"]} 
                label="Ticket" 
                selectedLabel={selectedLabel} 
                onSelect={selectFromRail}
                showRailTip={showRailTip}
                scheduleRailOverlayClose={scheduleRailOverlayClose}
                cancelRailOverlayClose={cancelRailOverlayClose} 
              />
            )}

            {/* Notifications — see Announcement entry below */}

            {/* Warning - Permission Guarded */}
            {permissions.canShowWarnings && (
            <MenuItem 
              icon={icons["Warning"]} 
              label="Warning" 
              selectedLabel={selectedLabel} 
              onSelect={selectFromRail}
              showRailTip={showRailTip}
              scheduleRailOverlayClose={scheduleRailOverlayClose}
              cancelRailOverlayClose={cancelRailOverlayClose} 
            />
            )}

            {/* Interview Panel */}
            {permissions.canViewInterviewPanel && (
              <MenuItem 
                icon={icons["Interview Panel"]} 
                label="Interview Panel" 
                selectedLabel={selectedLabel} 
                onSelect={selectFromRail}
                showRailTip={showRailTip}
                scheduleRailOverlayClose={scheduleRailOverlayClose}
                cancelRailOverlayClose={cancelRailOverlayClose} 
              />
            )}

            {permissions.canShowHRMS && (
              <DropdownHeader
                label="HRMS"
                icon={icons["HRMS"]}
                selectedLabel={selectedLabel}
                showRailFlyout={showRailFlyout}
                scheduleRailOverlayClose={scheduleRailOverlayClose}
                cancelRailOverlayClose={cancelRailOverlayClose}
                items={[
                  ...(permissions.canShowEmployees ? [{ label: "Employees", icon: icons["Employees"] }] : []),
                  ...(permissions.canShowLeaves ? [{ label: "Leave", icon: icons["Leave"] }] : []),
                  ...(permissions.canShowAttendance ? [{ label: "Attendance", icon: icons["Attendance"] }] : []),
                  ...(permissions.canShowDialerReport ? [{ label: "Dialer Report", icon: icons["Dialer Report"] }] : []),
                  ...(permissions.canShowOfferLetter ? [{ label: "Offer Letter", icon: icons["Offer Letter"] }] : []),
                ]}
                onItemSelect={selectFromRail}
              />
            )}

            {/* Apps */}
            {permissions.canShowApps && (
              <MenuItem 
                icon={icons["Apps"]} 
                label="Apps" 
                selectedLabel={selectedLabel} 
                onSelect={selectFromRail}
                showRailTip={showRailTip}
                scheduleRailOverlayClose={scheduleRailOverlayClose}
                cancelRailOverlayClose={cancelRailOverlayClose} 
              />
            )}
  {permissions.canViewNotifications && (
    <MenuItem 
      icon={icons["Announcement"]} 
      label="Announcement" 
      selectedLabel={selectedLabel} 
      onSelect={selectFromRail}
      showRailTip={showRailTip}
      scheduleRailOverlayClose={scheduleRailOverlayClose}
      cancelRailOverlayClose={cancelRailOverlayClose} 
    />
  )}
            {/* Reports */}
            {permissions.canViewReports && (
              <MenuItem 
                icon={icons["Reports"]} 
                label="Reports" 
                selectedLabel={selectedLabel} 
                onSelect={selectFromRail}
                showRailTip={showRailTip}
                scheduleRailOverlayClose={scheduleRailOverlayClose}
                cancelRailOverlayClose={cancelRailOverlayClose} 
              />
            )}

            {/* Settings */}
            {permissions.canShowSettings && (
              <MenuItem 
                icon={icons["Settings"]} 
                label="Settings" 
                selectedLabel={selectedLabel} 
                onSelect={selectFromRail}
                showRailTip={showRailTip}
                scheduleRailOverlayClose={scheduleRailOverlayClose}
                cancelRailOverlayClose={cancelRailOverlayClose} 
              />
            )}

            
          </nav>
        </div>

        {/* Down arrow */}
        {canScrollDown && (
          <button
            type="button"
            aria-label="Scroll down"
            className="flex items-center justify-center w-full py-0.5 text-white/40 hover:text-white/80 transition-colors shrink-0 border-t border-white/[0.06]"
            onClick={() => navRef.current?.scrollBy({ top: 80, behavior: 'smooth' })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
      </div>

      {railTip && createPortal(
        <div
          role="tooltip"
          className="pointer-events-none pl-2 max-w-[min(260px,calc(100vw-64px))]"
          style={{
            position: 'fixed',
            zIndex: 2147483647,
            left: railTip.left,
            top: railTip.top,
            transform: 'translateY(-50%)',
          }}
        >
          <div className="relative rounded-lg bg-[#2d2d2d] px-4 py-2.5 text-[15px] sm:text-base font-bold text-white shadow-xl border border-white/10 whitespace-nowrap">
            <span
              className="absolute right-full top-1/2 -translate-y-1/2 border-y-[8px] border-y-transparent border-r-[8px] border-r-[#2d2d2d]"
              aria-hidden
            />
            {railTip.label}
          </div>
        </div>,
        document.body
      )}

      {railFlyout && Array.isArray(railFlyout.items) && railFlyout.items.length > 0 && (() => {
        const maxH = typeof window !== 'undefined' ? Math.min(420, window.innerHeight - 24) : 420;
        const topClamped = typeof window !== 'undefined'
          ? Math.max(8, Math.min(railFlyout.top, window.innerHeight - maxH - 8))
          : railFlyout.top;
        return createPortal(
          <div
            className="w-[min(200px,calc(100vw-72px))] overflow-hidden rounded-xl border border-white/10 bg-[#141414] py-2 px-1.5 text-left shadow-2xl"
            style={{ position: 'fixed', zIndex: 2147483646, left: railFlyout.left, top: topClamped, maxHeight: maxH }}
            onMouseEnter={cancelRailOverlayClose}
            onMouseLeave={scheduleRailOverlayClose}
          >
            {railFlyout.label && (
              <div className="mb-1 border-b border-white/10 px-2.5 pb-2 pt-0.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/75">
                  {railFlyout.label}
                </p>
              </div>
            )}
            <ul className="flex max-h-[min(60vh,360px)] flex-col gap-0.5 overflow-y-auto pr-1">
              {railFlyout.items.map((item, flyIdx) => {
                const isSel = selectedLabel === item.label;
                return (
                  <li key={`fly-${item.label}-${item.id ?? 'noid'}-${flyIdx}`}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-xs font-semibold transition-all sm:text-[13px]',
                        isSel
                          ? 'bg-[#ffeb00] text-black'
                          : 'text-[#00d2ff] hover:bg-white hover:text-black'
                      )}
                      onClick={() => selectFromRail(item.label, item.isLoanType, item.id)}
                    >
                      <span className="flex shrink-0 items-center [&_img]:max-h-[18px] [&_img]:max-w-[18px] [&_img]:object-contain">
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}

export default React.memo(Sidebar);
