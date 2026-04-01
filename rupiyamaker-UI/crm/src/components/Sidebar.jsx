"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ),
  "Knowledge Base": (
    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
};

// Regular menu item - highlights IMMEDIATELY on click, then renders - Optimized with memoization
const MenuItem = React.memo(({ label, icon, isOpen, selectedLabel, onSelect }) => {
  // Memoized selection check with force update
  const [internalUpdate, setInternalUpdate] = useState(0);
  const isSelected = useMemo(() => {
    const stored = localStorage.getItem('selectedLabel');
    
    // If there's an explicit selection (from prop or localStorage), use ONLY that
    if (selectedLabel) return selectedLabel === label;
    if (stored) return stored === label;
    
    // Fallback: URL-based selection only when no explicit selection exists
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
      (label === 'Knowledge Base' && currentPath.includes('/knowledge-base')) ||
      (label === 'Offer Letter' && currentPath.includes('/offer-letter'))
    );
  }, [selectedLabel, label, internalUpdate]);
  
  const handleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // IMMEDIATE highlighting - update localStorage first for instant visual feedback
    localStorage.setItem('selectedLabel', label);
    
    // Force internal update for immediate visual feedback
    setInternalUpdate(prev => prev + 1);
    
    // Dispatch custom event for immediate updates
    window.dispatchEvent(new CustomEvent('sidebarSelectionChange', {
      detail: { selection: label }
    }));
    
    // Force immediate re-render of this component by triggering state change
    onSelect(label);
  }, [label, onSelect]);

  const activeStyle = isSelected ? {
    boxShadow: '0 0 15px rgba(255,235,0,0.25), inset 0 0 8px rgba(255,235,0,0.07)',
    border: '1px solid rgba(255,235,0,0.45)',
    transform: 'translateY(-1px)'
  } : {};

  return (
    <button
      className={cn(
        "flex items-center w-full p-2 sm:p-3 mb-1 rounded-xl transition-all text-sm sm:text-[15px] font-semibold animate-pop min-h-[44px] border border-transparent",
        isSelected
          ? "bg-[#ffeb00] text-black"
          : "bg-white/[0.07] hover:bg-white/[0.16] text-[#00d2ff] hover:border-white/[0.12]"
      )}
      style={activeStyle}
      onClick={handleClick}
    >
      {isOpen ? (
        <>
          <span className="mr-2 flex-shrink-0">{icon}</span>
          <span className="truncate">{label}</span>
        </>
      ) : (
        <span className="flex items-center justify-center w-full">
          {icon || <span className="text-xs font-bold">{label.charAt(0)}</span>}
        </span>
      )}
    </button>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.label === nextProps.label &&
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.selectedLabel === nextProps.selectedLabel
  );
});

// Sub-item inside dropdown - highlights IMMEDIATELY on click, then renders - Enhanced state checking
const SubItem = React.memo(({ label, icon, isOpen, selectedLabel, onSelect, isLoanType, loanTypeId }) => {
  // Enhanced selection checking - check both state and localStorage and URL context
  const currentSelectedLabel = localStorage.getItem('selectedLabel');
  const currentPath = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const loanTypeName = urlParams.get('loan_type_name');
  
  // Check if this item is selected — explicit selection takes priority
  const isSelected = (() => {
    // If there's an explicit selection, use ONLY that
    if (selectedLabel) return selectedLabel === label;
    if (currentSelectedLabel) return currentSelectedLabel === label;
    
    // Fallback: URL-based selection only when no explicit selection exists
    if (isLoanType && loanTypeName) {
      if (label === loanTypeName && currentPath.includes('/lead-crm')) return true;
      if (label === `${loanTypeName} Login` && currentPath.includes('/login-crm')) return true;
    }
    if (label === 'Employees' && currentPath.includes('/employees')) return true;
    if (label === 'Attendance' && currentPath.includes('/attendance')) return true;
    if (label === 'Leave' && currentPath.includes('/leave')) return true;
    if (label === 'Daily Performance' && currentPath.includes('/performance')) return true;
    if (label === 'Warning Dashboard' && currentPath.includes('/warning/dashboard')) return true;
    if (label === 'All Warnings' && currentPath.includes('/warning/all')) return true;
    if (label === 'My Warnings' && currentPath.includes('/warning/my') && !isSuperAdmin(JSON.parse(localStorage.getItem('userPermissions') || '{}'))) return true;
    if (label === 'Transfer Requests' && currentPath.includes('/transfer-requests')) return true;
    if (label === 'LEAD Dashboard' && currentPath.includes('/lead-dashboard')) return true;
    if (label === 'Create LEAD' && currentPath.includes('/create-lead')) return true;
    return false;
  })();  const handleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // IMMEDIATE highlighting - update localStorage first for instant visual feedback
    localStorage.setItem('selectedLabel', label);
    
    // Force immediate re-render of this component by triggering state change
    onSelect(label, isLoanType, loanTypeId);
  }, [label, onSelect, isLoanType, loanTypeId]);

  const subActiveStyle = isSelected ? {
    boxShadow: '0 2px 8px rgba(234,179,8,0.35)',
    border: '1px solid rgba(234,179,8,0.5)'
  } : {};

  return (
    <button
      className={cn(
        "flex items-center w-full p-2 text-left mb-0.5 rounded-lg transition-all duration-200 text-xs sm:text-[13px] font-medium animate-pop min-h-[38px] border border-transparent",
        isSelected
          ? "bg-yellow-400 text-gray-900 font-bold translate-x-1.5"
          : "bg-transparent hover:bg-blue-50 text-gray-700 hover:text-[#1a56db] hover:translate-x-1.5 hover:border-blue-200"
      )}
      style={subActiveStyle}
      onClick={handleClick}
    >
      {isOpen ? (
        <>
          <span className="mr-1 sm:mr-2 flex-shrink-0">{icon}</span>
          <span className="truncate">{label}</span>
        </>
      ) : (
        <span className="flex items-center justify-center w-full">
          {icon || <span className="text-xs font-bold">{label.charAt(0)}</span>}
        </span>
      )}
    </button>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.label === nextProps.label &&
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.selectedLabel === nextProps.selectedLabel &&
    prevProps.isLoanType === nextProps.isLoanType &&
    prevProps.loanTypeId === nextProps.loanTypeId
  );
});

// Dropdown header - ONLY toggles dropdown, NEVER navigates - Enhanced state checking
const DropdownHeader = React.memo(({ 
  label, 
  icon, 
  isOpen, 
  isExpanded, 
  selectedLabel, 
  items, 
  onToggle, 
  onItemSelect 
}) => {
  // Enhanced header highlighting - check if any sub-item is selected through multiple methods
  const currentSelectedLabel = localStorage.getItem('selectedLabel');
  const currentPath = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const loanTypeName = urlParams.get('loan_type_name');
  
  const hasActiveSubItem = useMemo(() => {
    const activeLabel = selectedLabel || currentSelectedLabel;
    
    // If there's an explicit selection, check if any sub-item matches it
    if (activeLabel) {
      return items.some(item => item.label === activeLabel);
    }
    
    // Fallback: URL-based detection only when no explicit selection
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
      // Parent dropdown highlight for loan type context
      loanTypeName && (
        (label === 'LEAD CRM' && (currentPath.includes('/lead-crm') || currentPath.includes('/leads'))) ||
        (label === 'Login CRM' && (currentPath.includes('/login-crm') || currentPath.includes('/login')))
      )
    );
  }, [items, selectedLabel, currentSelectedLabel, currentPath, loanTypeName, label]);

  const handleToggle = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle(label);
  }, [label, onToggle]);

  return (
    <div className="w-full">
      <button
        onClick={handleToggle}
        className={cn(
          "flex items-center w-full p-2 sm:p-3 mb-1 rounded-xl transition-all font-semibold text-sm sm:text-[15px] animate-pop min-h-[44px] border border-transparent",
          hasActiveSubItem
            ? "bg-[#ffeb00] text-black"
            : "bg-white/[0.07] hover:bg-white/[0.16] text-[#00d2ff] hover:border-white/[0.12]"
        )}
        style={hasActiveSubItem ? {
          boxShadow: '0 0 15px rgba(255,235,0,0.25), inset 0 0 8px rgba(255,235,0,0.07)',
          border: '1px solid rgba(255,235,0,0.45)',
          transform: 'translateY(-1px)'
        } : {}}
      >
        {isOpen ? (
          <>
            <span className="mr-2 flex-shrink-0">{icon}</span>
            <span className="flex-1 text-left truncate">{label}</span>
            <svg
              className="ml-1 w-3.5 h-3.5 shrink-0 transition-transform duration-300"
              style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        ) : (
          <span className="flex items-center justify-center w-full">
            {icon || <span className="text-xs font-bold">{label.charAt(0)}</span>}
          </span>
        )}
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded && isOpen ? '500px' : '0px',
          opacity: isExpanded && isOpen ? 1 : 0,
          transition: 'max-height 0.35s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease'
        }}
      >
        <div className="relative pl-9 pr-1 pt-1 pb-2 bg-white rounded-xl mx-1 my-1 border border-gray-200 shadow-md">
          {/* Yellow left border hierarchy indicator */}
          <div className="absolute left-5 top-2 bottom-2 w-[3px] bg-[#1a56db] rounded-full opacity-70"></div>
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => (
              <li key={`${label}-${item.label}-${item.id || 'static'}`}>
                <SubItem
                  label={item.label}
                  icon={item.icon}
                  isOpen={isOpen}
                  selectedLabel={selectedLabel}
                  onSelect={onItemSelect}
                  isLoanType={item.isLoanType}
                  loanTypeId={item.id}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
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
        staticItems: ['Feed', 'Task', 'Ticket', 'Notifications', 'Interview Panel', 'Knowledge Base', 'Apps', 'Settings', 'Reports'],
        dynamicDropdowns: ['LEAD CRM', 'Login CRM', 'HRMS', 'Warning'],
        lastUpdated: null
      };
    } catch {
      return {
        loanTypes: [],
        permissions: {},
        staticItems: ['Feed', 'Task', 'Ticket', 'Notifications', 'Interview Panel', 'Knowledge Base', 'Apps', 'Settings', 'Reports'],
        dynamicDropdowns: ['LEAD CRM', 'Login CRM', 'HRMS', 'Warning'],
        lastUpdated: null
      };
    }
  });

  // Core state management - ONLY for highlighting and UI state
  const [isPinnedOpen, setIsPinnedOpen] = useState(() => 
    localStorage.getItem('sidebarPinned') !== 'false'
  );
  const [isHovered, setIsHovered] = useState(false);
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
      const directPerms = localStorage.getItem('userPermissions');
      if (directPerms) {
        try {
          const parsed = JSON.parse(directPerms);
          if (parsed && Object.keys(parsed).length > 0) {
            console.log('✅ INIT: Loaded permissions from localStorage', Object.keys(parsed).length, 'keys');
            return parsed;
          }
        } catch (e) {
          console.warn('⚠️ INIT: Failed to parse userPermissions from localStorage');
        }
      }
      
      // Source 2: getUserPermissions utility
      const utilPerms = getUserPermissions();
      if (utilPerms && Object.keys(utilPerms).length > 0) {
        console.log('✅ INIT: Loaded permissions from getUserPermissions()', Object.keys(utilPerms).length, 'keys');
        return utilPerms;
      }
      
      // Source 3: Cached sidebar data
      if (sidebarMenuData.permissions && Object.keys(sidebarMenuData.permissions).length > 0) {
        console.log('✅ INIT: Loaded permissions from cached sidebar data', Object.keys(sidebarMenuData.permissions).length, 'keys');
        return sidebarMenuData.permissions;
      }
      
      // Fallback: Default permissions (Feed only)
      console.warn('⚠️ INIT: No permissions found, using default (Feed only)');
      return { feeds: { show: true } };
    } catch (error) {
      console.error('❌ INIT: Error loading initial permissions:', error);
      return { feeds: { show: true } };
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

  const isOpen = useMemo(() => isPinnedOpen || isHovered, [isPinnedOpen, isHovered]);
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

  // Toggle dropdown - accordion behavior
  const toggleDropdown = useCallback((name) => {
    setOpenDropdowns(prev => {
      const newState = {
        'LEAD CRM': false,
        'Login CRM': false,
        'HRMS': false,
        'Warning': false,
        [name]: !prev[name]
      };
      localStorage.setItem('openDropdowns', JSON.stringify(newState));
      return newState;
    });
  }, []);

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
        
        // Navigate with the full URL (including query parameters)
        navigateToRoute(fullRoute, label);
        
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
          
          // If still empty, set default permissions
          if (!loadedPermissions || Object.keys(loadedPermissions).length === 0) {
            console.warn('⚠️ No permissions found, using default permissions');
            loadedPermissions = { feeds: { show: true } };
          }
          
          console.log('✅ Final loaded permissions:', loadedPermissions);
        } catch (error) {
          console.error('❌ Error loading permissions:', error);
          loadedPermissions = { feeds: { show: true } };
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
          staticItems: ['Feed', 'Task', 'Ticket', 'Notifications', 'Interview Panel', 'Knowledge Base', 'Apps', 'Settings', 'Reports'],
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
              const cachedPerms = cachedData.permissions || { feeds: { show: true } };
              console.log('📦 Using cached permissions:', cachedPerms);
              setUserPermissions(cachedPerms);
              setPermissionsLoaded(true);
            }
            console.log('✅ Cached data loaded successfully');
          } else {
            console.warn('⚠️ No cached data available, using fallback permissions');
            if (!permissionsLoaded) {
              setUserPermissions({ feeds: { show: true } });
              setPermissionsLoaded(true);
            }
          }
        } catch (cacheError) {
          console.error('❌ Error loading cached data:', cacheError);
          // Final fallback
          if (!permissionsLoaded) {
            console.log('📦 Using final fallback permissions');
            setUserPermissions({ feeds: { show: true } });
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
    else if (currentPath.includes('/knowledge-base')) {
      targetLabel = 'Knowledge Base';
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
    
    // Also check based on selectedLabel
    const parentDropdown = itemToParentMap[selectedLabel];
    if (parentDropdown) {
      shouldOpenDropdown = parentDropdown;
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

  // Permission check helper - Enhanced with comprehensive fallback logic
  const checkPermission = useCallback((page, action) => {
    try {
      if (!userPermissions || Object.keys(userPermissions).length === 0) {
        console.warn(`⚠️ No permissions loaded yet for ${page}.${action}`);
        
        // CRITICAL FIX: Check if user is logged in - if yes, and permissions are
        // empty, likely a race condition. Be permissive (backend will still enforce).
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('token');
        const isLoggedIn = !!(userId && token);
        if (isLoggedIn && action === 'show') {
          const coreItems = ['feeds', 'leads', 'tasks', 'tickets', 'login', 'logins'];
          if (coreItems.includes(page.toLowerCase())) {
            console.log(`✅ Permissive access granted for core item ${page}.${action} (logged in, permissions loading)`);
            return true;
          }
        }
        
        // Always allow Feed
        return page === 'feeds' && action === 'show';
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
      
      // Fallback for critical pages - everyone should see Feed
      if (page === 'feeds' && action === 'show') {
        console.log(`✅ Default Feed access`);
        return true;
      }
      
      console.log(`❌ No permission found for ${page}.${action}`);
      return false;
    } catch (error) {
      console.error(`❌ Error checking permission for ${page}.${action}:`, error);
      // Fallback for feeds
      return page === 'feeds' && action === 'show';
    }
  }, [userPermissions]);

  // Memoized permission checks for better performance - Enhanced with multiple checks and logging
  const permissions = useMemo(() => {
    console.log('🔐 ========================================');
    console.log('🔐 SIDEBAR PERMISSION CALCULATION START');
    console.log('🔐 ========================================');
    console.log('🔐 User Permissions Object:', userPermissions);
    console.log('🔐 Is Super Admin:', isSuperAdmin(userPermissions));
    console.log('🔐 ========================================');
    
    const perms = {
      // LEAD CRM - Check multiple variations including sub-page dot-notation
      canShowLeads: checkPermission('leads', 'show') ||
                    checkPermission('Leads', 'show') ||
                    checkPermission('LEADS', 'show') ||
                    checkPermission('lead', 'show') ||
                    checkPermission('leads.create_lead', 'show') ||
                    checkPermission('leads.pl_odd_leads', 'show') ||
                    isSuperAdmin(userPermissions),
      
      // Feed - Always visible
      canShowFeeds: true,
      
      // Tasks - Check multiple variations
      canShowTasks: checkPermission('tasks', 'show') || 
                    checkPermission('Tasks', 'show') || 
                    checkPermission('task', 'show') ||
                    isSuperAdmin(userPermissions),
      
      // Tickets - Check multiple variations
      canShowTickets: checkPermission('tickets', 'show') || 
                      checkPermission('Tickets', 'show') || 
                      checkPermission('ticket', 'show') ||
                      isSuperAdmin(userPermissions),
      
      // HRMS - Check multiple variations including sub-modules
      canShowHRMS: checkPermission('hrms', 'show') || 
                   checkPermission('HRMS', 'show') || 
                   checkPermission('employees', 'show') ||
                   checkPermission('Employees', 'show') ||
                   checkPermission('warnings', 'show') ||
                   checkPermission('attendance', 'show') ||
                   checkPermission('leaves', 'show') ||
                   checkPermission('offer_letter', 'show') ||
                   checkPermission('Offer Letter', 'show') ||
                   isSuperAdmin(userPermissions),
      
      // Employees
      canShowEmployees: checkPermission('employees', 'show') || 
                        checkPermission('Employees', 'show') ||
                        isSuperAdmin(userPermissions),

      // Dialer Report
      canShowDialerReport: checkPermission('dialer_report', 'show') ||
                           isSuperAdmin(userPermissions),
      
      // Apps
      canShowApps: checkPermission('apps', 'show') || 
                   checkPermission('Apps', 'show') || 
                   isSuperAdmin(userPermissions),
      
      // Settings
      canShowSettings: checkPermission('settings', 'show') || 
                       checkPermission('Settings', 'show') || 
                       isSuperAdmin(userPermissions),
      
      // Login CRM - Check using utility and fallbacks
      canViewLoginCRM: canViewLoginCRM(userPermissions) || 
                       checkPermission('login', 'show') || 
                       checkPermission('Login', 'show') || 
                       checkPermission('logins', 'show') ||
                       isSuperAdmin(userPermissions),
      
      // Interview Panel - Check using utility and fallbacks
      canViewInterviewPanel: canViewInterviewPanel(userPermissions) || 
                             checkPermission('interview', 'show') || 
                             checkPermission('Interview', 'show') || 
                             checkPermission('interviews', 'show') ||
                             isSuperAdmin(userPermissions),
      
      // Reports - Check using utility and fallbacks
      canViewReports: canViewReports(userPermissions) || 
                      checkPermission('reports', 'show') || 
                      checkPermission('Reports', 'show') || 
                      checkPermission('report', 'show') ||
                      isSuperAdmin(userPermissions),
      
      // Notifications/Announcement - Check using utility and fallbacks
      canViewNotifications: canViewNotifications(userPermissions) || 
                            checkPermission('notifications', 'show') || 
                            checkPermission('Notifications', 'show') || 
                            checkPermission('notification', 'show') ||
                            checkPermission('announcement', 'show') ||
                            checkPermission('Announcement', 'show') ||
                            isSuperAdmin(userPermissions),

      // Warnings - Check permission or super admin
      canShowWarnings: checkPermission('warnings', 'show') ||
                       checkPermission('Warnings', 'show') ||
                       checkPermission('warning', 'show') ||
                       isSuperAdmin(userPermissions),

      // Attendance - individual check for HRMS dropdown items
      canShowAttendance: checkPermission('attendance', 'show') ||
                         checkPermission('Attendance', 'show') ||
                         checkPermission('hrms', 'show') ||
                         isSuperAdmin(userPermissions),

      // Leaves - individual check for HRMS dropdown items
      canShowLeaves: checkPermission('leaves', 'show') ||
                     checkPermission('Leaves', 'show') ||
                     checkPermission('leave', 'show') ||
                     checkPermission('hrms', 'show') ||
                     isSuperAdmin(userPermissions),

      // Offer Letter - individual check for HRMS dropdown items
      canShowOfferLetter: checkPermission('offer_letter', 'show') ||
                          checkPermission('Offer Letter', 'show') ||
                          checkPermission('offerLetter', 'show') ||
                          isSuperAdmin(userPermissions),

      // Knowledge Base - admin always sees it, others need explicit permission
      canShowKnowledgeBase: isSuperAdmin(userPermissions) ||
                            checkPermission('knowledge_base', 'show') ||
                            checkPermission('Knowledge Base', 'show') ||
                            checkPermission('knowledgebase', 'show')
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
  }, [checkPermission, userPermissions]);

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

  if (!permissionsLoaded || !menuDataLoaded) {
    return (
      <div className="h-screen w-[72px] bg-black border-r border-[#1f1f1f] flex items-center justify-center">
        <div className="text-[#00d2ff] text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "h-screen relative transition-all duration-300 z-10 bg-black/90 backdrop-blur-xl border-r border-white/[0.08] shadow-2xl",
        // Desktop width behavior
        isOpen
          ? "w-[260px]"
          : "w-[72px]"
      )}
      onMouseEnter={() => !isPinnedOpen && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <style>{`
        #sidebar-nav::-webkit-scrollbar { width: 4px; }
        #sidebar-nav::-webkit-scrollbar-track { background: transparent; }
        #sidebar-nav::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
        #sidebar-nav::-webkit-scrollbar-thumb:hover { background: #444; }
      `}</style>
      <div className="flex flex-col h-full relative z-50">
        {/* Header */}
        <div className="flex items-center flex-shrink-0 h-14 px-3 border-b border-white/[0.08] gap-3 shrink-0">
          <button
            onClick={() => {
              const newState = !isPinnedOpen;
              setIsPinnedOpen(newState);
              localStorage.setItem('sidebarPinned', newState.toString());
            }}
            className="group text-[#00d2ff] hover:text-white transition-all p-2 rounded-full hover:bg-white/10 active:bg-white/20 active:scale-95 focus:outline-none flex items-center justify-center"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          {isOpen && (
            <div className="flex items-center gap-1 font-extrabold text-[17px] tracking-wide whitespace-nowrap overflow-hidden">
              <span className="text-[#00d2ff]">RupiyaMaker</span>
              <span
                className="font-serif italic text-[#ffeb00]"
                style={{ textShadow: '0 0 8px rgba(255,235,0,0.45)' }}
              >₹</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div id="sidebar-nav" className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden touch-pan-y"
             style={{ WebkitOverflowScrolling: 'touch' }}>
          <nav className="flex flex-col gap-1 touch-manipulation"
               style={{ touchAction: 'pan-y' }}>
            {/* Feed */}
            <MenuItem 
              icon={icons["Feed"]} 
              label="Feed" 
              isOpen={isOpen} 
              selectedLabel={selectedLabel} 
              onSelect={handleSelection} 
            />

            {/* LEAD CRM Dropdown */}
            {permissions.canShowLeads && (
              <DropdownHeader
                label="LEAD CRM"
                icon={icons["LEAD CRM"]}
                isOpen={isOpen}
                isExpanded={openDropdowns["LEAD CRM"]}
                selectedLabel={selectedLabel}
                onToggle={toggleDropdown}
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
                onItemSelect={handleSelection}
              />
            )}

            {/* Login CRM Dropdown */}
            {permissions.canViewLoginCRM && (
              <DropdownHeader
                label="Login CRM"
                icon={icons["Login CRM"]}
                isOpen={isOpen}
                isExpanded={openDropdowns["Login CRM"]}
                selectedLabel={selectedLabel}
                onToggle={toggleDropdown}
                items={loginCrmLoanTypeItems}
                onItemSelect={handleSelection}
              />
            )}

            {/* Task */}
            {permissions.canShowTasks && (
              <MenuItem 
                icon={icons["Task"]} 
                label="Task" 
                isOpen={isOpen} 
                selectedLabel={selectedLabel} 
                onSelect={handleSelection} 
              />
            )}

            {/* Ticket */}
            {permissions.canShowTickets && (
              <MenuItem 
                icon={icons["Ticket"]} 
                label="Ticket" 
                isOpen={isOpen} 
                selectedLabel={selectedLabel} 
                onSelect={handleSelection} 
              />
            )}

            {/* Notifications */}
            {/* {permissions.canViewNotifications && (
              <MenuItem 
                icon={icons["Notifications"]} 
                label="Announcement" 
                isOpen={isOpen} 
                selectedLabel={selectedLabel} 
                onSelect={handleSelection} 
              /> */}
            

            {/* Warning - Permission Guarded */}
            {permissions.canShowWarnings && (
            <MenuItem 
              icon={icons["Warning"]} 
              label="Warning" 
              isOpen={isOpen} 
              selectedLabel={selectedLabel} 
              onSelect={handleSelection} 
            />
            )}

            {/* Interview Panel */}
            {permissions.canViewInterviewPanel && (
              <MenuItem 
                icon={icons["Interview Panel"]} 
                label="Interview Panel" 
                isOpen={isOpen} 
                selectedLabel={selectedLabel} 
                onSelect={handleSelection} 
              />
            )}

            {/* HRMS Dropdown */}
            {permissions.canShowHRMS && (
              <DropdownHeader
                label="HRMS"
                icon={icons["HRMS"]}
                isOpen={isOpen}
                isExpanded={openDropdowns["HRMS"]}
                selectedLabel={selectedLabel}
                onToggle={toggleDropdown}
                items={[
                  ...(permissions.canShowEmployees ? [{ label: "Employees", icon: icons["Employees"] }] : []),
                  ...(permissions.canShowLeaves ? [{ label: "Leave", icon: icons["Leave"] }] : []),
                  ...(permissions.canShowAttendance ? [{ label: "Attendance", icon: icons["Attendance"] }] : []),
                  ...(permissions.canShowDialerReport ? [{ label: "Dialer Report", icon: icons["Dialer Report"] }] : []),
                  ...(permissions.canShowOfferLetter ? [{ label: "Offer Letter", icon: icons["Offer Letter"] }] : []),
                ]}
                onItemSelect={handleSelection}
              />
            )}
            
            {/* Apps */}
            {permissions.canShowApps && (
              <MenuItem 
                icon={icons["Apps"]} 
                label="Apps" 
                isOpen={isOpen} 
                selectedLabel={selectedLabel} 
                onSelect={handleSelection} 
              />
            )}
  {permissions.canViewNotifications && (
    <MenuItem 
      icon={icons["Announcement"]} 
      label="Announcement" 
      isOpen={isOpen} 
      selectedLabel={selectedLabel} 
      onSelect={handleSelection} 
    />
  )}
            {/* Reports */}
            {permissions.canViewReports && (
              <MenuItem 
                icon={icons["Reports"]} 
                label="Reports" 
                isOpen={isOpen} 
                selectedLabel={selectedLabel} 
                onSelect={handleSelection} 
              />
            )}

            {/* Settings */}
            {permissions.canShowSettings && (
              <MenuItem 
                icon={icons["Settings"]} 
                label="Settings" 
                isOpen={isOpen} 
                selectedLabel={selectedLabel} 
                onSelect={handleSelection} 
              />
            )}

            
          </nav>
        </div>
      </div>
    </div>
  );
}

export default React.memo(Sidebar);
