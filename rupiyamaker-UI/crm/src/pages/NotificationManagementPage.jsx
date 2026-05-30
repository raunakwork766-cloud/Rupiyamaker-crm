import React, { useState, useEffect, useRef } from "react";
import { useNavigationType } from 'react-router-dom';
import useNavbarPageSearch from '../hooks/useNavbarPageSearch';
import { 
  Bell, 
  Plus, 
  Send, 
  Eye, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  AlertCircle,
  Power,
  BarChart3,
  Trash2,
  Edit,
  MessageSquare,
  X,
  User,
  Calendar,
  ChevronDown,
  CheckCircle,
  XCircle
} from "lucide-react";
import { API_BASE_URL } from '../config/api';
import { formatDateTime } from '../utils/dateUtils';
import { getUserPermissions, hasPermission, isSuperAdmin } from '../utils/permissions';

const announcementPageStyles = `
  .task-page-container { padding: 0; max-width: 100%; background: #000; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Lexend Deca', sans-serif; color: #e2e8f0; }
  .task-top-bar { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 24px 0; border-bottom: 1px solid #1f1f27; background: #000; }
  .task-top-bar-left h1 { font-size: 22px; font-weight: 700; color: #f0f0f5; margin: 0 0 2px; line-height: 1.2; }
  .task-top-bar-left p { font-size: 13px; color: #6b7a99; margin: 0 0 12px; }
  .task-top-bar-right { display: flex; gap: 8px; align-items: center; padding-top: 4px; }
  .task-btn-secondary { background: #1a1a24; color: #c8d0e0; border: 1px solid #2a2a3a; padding: 7px 14px; border-radius: 3px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.15s, border-color 0.15s; white-space: nowrap; }
  .task-btn-secondary:hover { background: #22222e; border-color: #3a3a50; }
  .task-btn-create { background: #3b82f6; color: #fff; border: none; padding: 7px 14px; border-radius: 3px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.15s; white-space: nowrap; }
  .task-btn-create:hover { background: #2563eb; }
  .task-btn-select { background: #1a1a24; color: #c8d0e0; border: 1px solid #2a2a3a; padding: 7px 14px; border-radius: 3px; font-size: 13px; font-weight: 500; cursor: pointer; }
  .task-btn-select:hover { background: #22222e; }
  .task-view-toggle-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 24px; background: #000; border-bottom: 1px solid #1f1f27; flex-wrap: wrap; }
  .task-view-toggle-group { display: flex; gap: 0; flex-wrap: wrap; flex: 0 1 auto; min-width: 0; }
  .task-view-toggle-btn { padding: 12px 16px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #6b7a99; cursor: pointer; border-bottom: 3px solid transparent; transition: color 0.15s, border-color 0.15s; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; }
  .task-view-toggle-btn:hover { color: #c8d0e0; }
  .task-view-toggle-btn.active { color: #f97316; font-weight: 800; border-bottom-color: #f97316; }
  .task-view-toggle-btn.active-logout { color: #f87171; border-bottom-color: #f87171; }
  .task-search-box--in-bar { position: relative; width: 260px; min-width: 200px; flex-shrink: 0; }
  .task-search-box--in-bar input { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 3px; padding: 6px 14px 6px 32px; color: #c8d0e0; font-size: 13px; width: 100%; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
  .task-search-box--in-bar input::placeholder { color: #4a5570; }
  .task-search-box--in-bar input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .task-search-box--in-bar svg { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: #4a5570; }
  .task-toolbar-right { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-left: auto; flex-shrink: 0; flex-wrap: wrap; }
  .task-select-controls { display: flex; align-items: center; gap: 8px; }
  .task-select-controls label { display: flex; align-items: center; cursor: pointer; color: #c8d0e0; font-size: 13px; gap: 5px; }
  .task-select-controls span { color: #6b7a99; font-size: 13px; }
  .task-select-btn-del { padding: 5px 12px; background: #1a0a0a; color: #f87171; border: 1px solid #7f1d1d; border-radius: 3px; font-size: 13px; cursor: pointer; }
  .task-select-btn-del:hover { background: #2a0f0f; }
  .task-select-btn-del:disabled { opacity: 0.4; cursor: not-allowed; }
  .task-select-btn-cancel { padding: 5px 12px; background: #1a1a24; color: #6b7a99; border: 1px solid #2a2a3a; border-radius: 3px; font-size: 13px; cursor: pointer; }
  .task-select-btn-cancel:hover { background: #22222e; }
  .task-data-table-header { background: #ffffff; border-top: 1px solid #e5e7eb; border-bottom: 2px solid #e5e7eb; display: flex; padding: 12px 24px; align-items: center; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); position: sticky; top: 0; z-index: 20; }
  .task-th { color: #03b0f5; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; text-align: left; flex: 1; }
  .task-th.number { flex: 0 0 36px; }
  .task-th.checkbox { flex: 0 0 36px; }
  .task-th.date { flex: 1.2; }
  .task-th.created { flex: 1.2; }
  .task-th.subject { flex: 2; }
  .task-th.target { flex: 1.5; }
  .task-th.progress { flex: 1.2; }
  .task-th.action { flex: 0 0 100px; }
  .task-data-table-body { display: flex; flex-direction: column; max-height: calc(100vh - 220px); overflow-y: auto; }
  .task-row { background: #000; border-bottom: 1px solid #1a1a22; display: flex; padding: 11px 24px; align-items: center; cursor: pointer; transition: background 0.1s; }
  .task-row:hover { background: #13131c; }
  .task-row.selected { background: #0a1a2a; }
  .task-row.deactivated { opacity: 0.55; }
  .task-td { font-size: 13px; color: #ffffff; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 12px; }
  .task-td.number { flex: 0 0 36px; color: #60a5fa; font-size: 12px; font-weight: 700; }
  .task-td.checkbox { flex: 0 0 36px; }
  .task-td.date { flex: 1.2; }
  .task-td.created { flex: 1.2; }
  .task-td.subject { flex: 2; font-weight: 700; white-space: normal; }
  .task-td.target { flex: 1.5; white-space: normal; }
  .task-td.progress { flex: 1.2; white-space: normal; }
  .task-td.action { flex: 0 0 100px; }
  .ann-deactivated-badge { display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 2px; font-size: 10px; font-weight: 700; background: #1a0a0a; color: #f87171; border: 1px solid #7f1d1d; margin-left: 8px; }
  .ann-type-badge { display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 2px; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-right: 6px; }
  .ann-type-general { background: #0a1a2a; color: #60a5fa; border: 1px solid #1e3a5f; }
  .ann-type-logout { background: #1a0a0a; color: #f87171; border: 1px solid #7f1d1d; }
  .ann-target-all { color: #34d399; }
  .ann-target-dept { color: #60a5fa; }
  .ann-target-ind { color: #c084fc; }
  .ann-progress-wrap { display: flex; flex-direction: column; gap: 4px; min-width: 90px; }
  .ann-progress-stats { display: flex; gap: 8px; font-size: 11px; }
  .ann-progress-stats .accepted { color: #34d399; }
  .ann-progress-stats .pending { color: #fbbf24; }
  .ann-progress-stats .total { color: #6b7a99; }
  .ann-progress-bar { width: 100%; height: 4px; background: #1a1a24; border-radius: 2px; overflow: hidden; }
  .ann-progress-fill { height: 100%; background: linear-gradient(90deg, #34d399, #10b981); transition: width 0.3s; }
  .ann-progress-pct { font-size: 11px; color: #6b7a99; }
  .ann-action-btn { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 2px; font-size: 11px; font-weight: 700; cursor: pointer; border: 1px solid transparent; letter-spacing: 0.3px; }
  .ann-action-btn--start { background: #0a2a22; color: #34d399; border-color: #064e3b; }
  .ann-action-btn--start:hover { background: #0f3d32; }
  .ann-action-btn--stop { background: #1a0a0a; color: #f87171; border-color: #7f1d1d; }
  .ann-action-btn--stop:hover { background: #2a0f0f; }
  .ann-action-btn--done { background: #0a2a22; color: #34d399; border-color: #064e3b; cursor: default; }
  .task-empty-state { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px 20px; text-align: center; }
  .task-empty-state-title { font-size: 17px; font-weight: 700; color: #c8d0e0; margin: 0 0 6px; }
  .task-empty-state-sub { font-size: 14px; color: #4a5570; margin: 0; }
  .task-loading-spinner { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px 20px; }
  .task-loading-spinner .spinner { width: 32px; height: 32px; border: 3px solid #1a1a24; border-top-color: #3b82f6; border-radius: 50%; animation: annSpin 0.7s linear infinite; margin-bottom: 12px; }
  @keyframes annSpin { to { transform: rotate(360deg); } }
  .task-error-banner { margin: 12px 24px 0; padding: 12px 16px; background: #1a0a0a; border: 1px solid #7f1d1d; border-radius: 3px; color: #f87171; font-size: 13px; }
  .task-success-banner { margin: 12px 24px 0; padding: 12px 16px; background: #0a2a22; border: 1px solid #064e3b; border-radius: 3px; color: #34d399; font-size: 13px; }
  .task-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; backdrop-filter: blur(4px); padding: 16px; box-sizing: border-box; }
  .task-modal-container { background: #000; border: 1px solid #1f1f27; width: 100%; max-width: 760px; max-height: 96vh; border-radius: 4px; position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.7); display: flex; flex-direction: column; overflow: hidden; animation: annModalIn 0.2s ease-out; }
  .task-modal-container--wide { max-width: 960px; }
  .task-modal-close { position: absolute; right: 12px; top: 12px; background: transparent; border: none; color: #6b7a99; font-size: 22px; cursor: pointer; z-index: 10; line-height: 1; padding: 4px; }
  .task-modal-close:hover { color: #f87171; }
  .task-modal-header { padding: 20px 24px; border-bottom: 1px solid #1f1f27; flex-shrink: 0; }
  .task-modal-header h2 { margin: 0; font-size: 18px; font-weight: 700; color: #f0f0f5; }
  .task-modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
  .ann-form-label { display: block; font-size: 11px; font-weight: 700; color: #6b7a99; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .ann-form-input, .ann-form-textarea, .ann-form-select { width: 100%; background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 3px; padding: 8px 12px; color: #f0f0f5; font-size: 13px; outline: none; box-sizing: border-box; font-weight: 500; }
  .ann-form-input:focus, .ann-form-textarea:focus, .ann-form-select:focus { border-color: #3b82f6; }
  .ann-form-input--readonly { opacity: 0.75; cursor: default; }
  .ann-form-textarea { resize: vertical; min-height: 80px; }
  .ann-form-hint { font-size: 12px; color: #6b7a99; margin-top: 6px; }
  .ann-form-row { display: flex; gap: 16px; flex-wrap: wrap; }
  .ann-form-row > * { flex: 1; min-width: 200px; }
  .ann-form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #1f1f27; }
  .ann-dropdown-trigger { width: 100%; background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 3px; padding: 8px 12px; color: #f0f0f5; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; min-height: 38px; box-sizing: border-box; }
  .ann-dropdown-panel { position: fixed; background: #0d0d12; border: 1px solid #2a2a3a; border-radius: 4px; box-shadow: 0 12px 40px rgba(0,0,0,0.6); z-index: 10001; max-height: 280px; display: flex; flex-direction: column; overflow: hidden; }
  .ann-dropdown-search { padding: 10px; border-bottom: 1px solid #1f1f27; background: #0d0d12; }
  .ann-dropdown-search input { width: 100%; background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 3px; padding: 7px 10px; color: #f0f0f5; font-size: 13px; outline: none; box-sizing: border-box; }
  .ann-dropdown-list { overflow-y: auto; max-height: 220px; }
  .ann-dropdown-item { padding: 10px 12px; cursor: pointer; display: flex; align-items: center; gap: 10px; color: #c8d0e0; font-size: 13px; }
  .ann-dropdown-item:hover { background: #1a1a24; }
  .ann-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: #0a1a2a; color: #60a5fa; border: 1px solid #1e3a5f; border-radius: 2px; font-size: 11px; font-weight: 600; margin: 2px; }
  .ann-chip-remove { background: none; border: none; color: #6b7a99; cursor: pointer; padding: 0; line-height: 1; }
  .ann-chip-remove:hover { color: #f87171; }
  .ann-stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
  .ann-stat-card { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 4px; padding: 14px; display: flex; align-items: center; gap: 12px; }
  .ann-stat-card p { margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
  .ann-stat-card span { font-size: 22px; font-weight: 700; color: #f0f0f5; }
  .ann-stat-accepted p { color: #34d399; }
  .ann-stat-pending p { color: #fbbf24; }
  .ann-stat-rate p { color: #60a5fa; }
  .ann-user-list { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 4px; max-height: 140px; overflow-y: auto; padding: 8px; }
  .ann-user-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid #1f1f27; font-size: 12px; color: #c8d0e0; }
  .ann-user-row:last-child { border-bottom: none; }
  .ann-user-empty { text-align: center; padding: 24px; color: #4a5570; font-size: 13px; }
  @keyframes annModalIn { from { transform: scale(0.97) translateY(8px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
`;

/**
 * NotificationManagementPage - Admin interface for global notifications
 * 
 * This page allows users with notification permissions to:
 * - Send new global notifications
 * - View all sent notifications
 * - See acceptance statistics
 * - Deactivate notifications
 * - View detailed history
 */
const NotificationManagementPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [stats, setStats] = useState(null);
  // POP = browser back → restore tab; PUSH/REPLACE = sidebar click → always show default
  const navigationType = useNavigationType();
  const [activeTab, setActiveTab] = useState(() =>
    navigationType === 'POP' ? (localStorage.getItem('notifMgmtTab') || 'all') : 'all'
  );
  useEffect(() => { localStorage.setItem('notifMgmtTab', activeTab); }, [activeTab]);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    targetType: "all", // all, department, individual
    targetDepartments: [],
    targetEmployees: [],
    notificationType: "general" // 'general' or 'logout'
  });

  // Multi-select state
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);

  // Search states for dropdowns
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Dropdown position states (true = open upward, false = open downward)
  const [departmentDropdownOpenUp, setDepartmentDropdownOpenUp] = useState(false);
  const [employeeDropdownOpenUp, setEmployeeDropdownOpenUp] = useState(false);
  
  // Dropdown position coordinates for fixed positioning
  const [departmentDropdownPosition, setDepartmentDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [employeeDropdownPosition, setEmployeeDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Refs for click-outside detection
  const departmentDropdownRef = useRef(null);
  const employeeDropdownRef = useRef(null);
  
  // Ref for auto-resizing textarea
  const notificationDetailsRef = useRef(null);

  // Announcement popup state
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);

  // Selection state for bulk actions
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showCheckboxes, setShowCheckboxes] = useState(false); // Control checkbox visibility
  
  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  useNavbarPageSearch(setSearchTerm);
  
  // Filter notifications by type
  const getFilteredNotifications = () => {
    if (activeTab === 'all') return notifications;
    return notifications.filter(n => n.notification_type === activeTab);
  };
  
  const [announcementData, setAnnouncementData] = useState(null);

  // Notification sound ref
  const notificationSoundRef = useRef(null);

  // Permission management
  const [permissions, setPermissions] = useState({
    view: true,
    send: false,
    delete: false
  });

  // Load permissions
  useEffect(() => {
    try {
      const userPermissions = getUserPermissions();
      
      if (isSuperAdmin(userPermissions)) {
        setPermissions({
          view: true,
          send: true,
          delete: true
        });
        return;
      }

      const notificationPermissions = {
        view: hasPermission(userPermissions, 'notification', 'view') || hasPermission(userPermissions, 'Notification', 'view'),
        send: hasPermission(userPermissions, 'notification', 'send') || hasPermission(userPermissions, 'Notification', 'send') ||
              hasPermission(userPermissions, 'notification', 'create') || hasPermission(userPermissions, 'Notification', 'create'),
        delete: hasPermission(userPermissions, 'notification', 'delete') || hasPermission(userPermissions, 'Notification', 'delete')
      };

      if (userPermissions?.notification === "*" || userPermissions?.Notification === "*") {
        setPermissions({
          view: true,
          send: true,
          delete: true
        });
        return;
      }

      setPermissions({
        view: notificationPermissions.view || true,
        send: notificationPermissions.send,
        delete: notificationPermissions.delete
      });
    } catch (error) {
      console.error("Error loading permissions:", error);
      setPermissions({
        view: true,
        send: false,
        delete: false
      });
    }
  }, []);

  // Click outside handler to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (departmentDropdownRef.current && !departmentDropdownRef.current.contains(event.target)) {
        setShowDepartmentDropdown(false);
        setDepartmentSearch(""); // Clear search when closing
      }
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target)) {
        setShowEmployeeDropdown(false);
        setEmployeeSearch(""); // Clear search when closing
      }
    };

    if (showDepartmentDropdown || showEmployeeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDepartmentDropdown, showEmployeeDropdown]);

  // Auto-resize textarea for notification details
  useEffect(() => {
    const resizeTextarea = () => {
      if (notificationDetailsRef.current) {
        notificationDetailsRef.current.style.height = 'auto';
        notificationDetailsRef.current.style.height = notificationDetailsRef.current.scrollHeight + 'px';
      }
    };
    
    // Resize when formData.message changes or modal opens
    if (showCreateForm) {
      resizeTextarea();
    }
  }, [formData.message, showCreateForm]);

  // Handler for textarea change with auto-resize
  const handleNotificationDetailsChange = (e) => {
    setFormData({ ...formData, message: e.target.value });
    
    // Auto-resize textarea
    if (e.target) {
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    }
  };

  // Handle blur for uppercase conversion
  const handleBlur = (field) => {
    if (typeof formData[field] === 'string') {
      setFormData((prev) => ({ ...prev, [field]: prev[field].toUpperCase() }));
    }
  };

  // Calculate dropdown position (upward or downward)
  const calculateDropdownPosition = (ref, setOpenUp, setPosition) => {
    if (!ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const dropdownHeight = 280; // Approximate dropdown height (max-h-60 + search bar)
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Open upward if not enough space below and more space above
    const openUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    setOpenUp(openUp);
    
    // Calculate exact position for fixed positioning
    setPosition({
      top: openUp ? rect.top - dropdownHeight : rect.bottom,
      left: rect.left,
      width: rect.width
    });
  };

  // Filter departments by search
  const filteredDepartments = departments.filter(dept => {
    const deptName = dept.name || dept.department_name || dept.title || '';
    return deptName.toLowerCase().includes(departmentSearch.toLowerCase());
  });

  // Filter employees by search
  const filteredEmployees = employees.filter(emp => {
    const displayName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.name || emp.username || '';
    return displayName.toLowerCase().includes(employeeSearch.toLowerCase());
  });

  // Priority configurations
  const priorityConfig = {
    urgent: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
    high: { icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
    normal: { icon: Info, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
    low: { icon: Bell, color: "text-gray-600", bg: "bg-gray-50", border: "border-gray-200" }
  };

  // Get user ID from localStorage (using _id as mentioned)
  const getUserId = () => {
    try {
      const userId = localStorage.getItem('userId') || localStorage.getItem('user_id');
      if (userId) return userId;
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        return parsedUser._id || parsedUser.id || parsedUser.user_id;
      }
      return null;
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const userId = getUserId();
      if (!userId) {
        setError('User ID not found');
        setLoading(false);
        return;
      }

      // Always fetch ALL notifications (including inactive ones)
      // Using per_page=500 to show all notifications at once
      const response = await fetch(`${API_BASE_URL}/pop-notifications/?user_id=${userId}&include_inactive=true&per_page=500`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Normalize list items: ensure `id` exists (fallback to _id)
        const items = (data.notifications || []).map(n => ({ ...n, id: n.id || n._id }));
        setNotifications(items);
        setError(null);
      } else {
        throw new Error("Failed to fetch notifications");
      }
    } catch (error) {
      setError("Failed to load notifications");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const userId = getUserId();
      if (!userId) {
        console.error('User ID not found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/pop-notifications/stats/overview?user_id=${userId}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  // Fetch departments from API
  const fetchDepartments = async () => {
    try {
      console.log('🏢 Fetching departments from:', `${API_BASE_URL}/departments`);
      const response = await fetch(`${API_BASE_URL}/departments?user_id=None`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });

      console.log('🏢 Departments API response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('🏢 Departments API response data:', data);
        // Handle both array response or object with departments array
        const departmentList = Array.isArray(data) ? data : (data.departments || []);
        console.log('🏢 Processed departments list:', departmentList);
        setDepartments(departmentList);
      } else {
        console.error("Failed to fetch departments:", response.statusText);
        const errorText = await response.text();
        console.error("Departments API error details:", errorText);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  // Fetch users/employees from API — uses tasks/users-for-assignment which filters inactive at DB level
  const fetchEmployees = async () => {
    try {
      const userId = getUserId();
      const url = `${API_BASE_URL}/tasks/users-for-assignment?user_id=${userId}`;
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Response is { users: [...] } — each user has user_id, first_name, last_name, etc.
        const rawList = Array.isArray(data) ? data : (data.users || []);
        // Normalise shape so rest of the page works as before (_id, first_name, last_name expected)
        const userList = rawList.map(u => ({
          ...u,
          _id: u.user_id || u._id || u.id,
          first_name: u.first_name || '',
          last_name: u.last_name || '',
          name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
          // Already filtered by backend, but keep safety net
          employee_status: u.employee_status || 'active',
          is_active: u.is_active !== false,
        })).filter(u => u.employee_status !== 'inactive' && u.is_active !== false);
        setEmployees(userList);
      } else {
        // Fallback: hit /users but still exclude inactive
        const fallbackResp = await fetch(`${API_BASE_URL}/users`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
        });
        if (fallbackResp.ok) {
          const data = await fallbackResp.json();
          const rawList = Array.isArray(data) ? data : (data.users || []);
          setEmployees(rawList.filter(u => u.employee_status !== 'inactive' && u.is_active !== false));
        }
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  // Helper function to get department names from IDs
  const getDepartmentNames = (departmentIds) => {
    if (!departmentIds || departmentIds.length === 0) return [];
    return departmentIds.map(id => {
      const dept = departments.find(d => d._id === id || d.id === id);
      return dept ? dept.name : `Unknown (${id})`;
    });
  };

  // Helper function to get employee names from IDs
  const getEmployeeNames = (employeeIds) => {
    if (!employeeIds || employeeIds.length === 0) return [];
    return employeeIds.map(id => {
      const emp = employees.find(e => e._id === id || e.id === id);
      if (emp) {
        const firstName = emp.first_name || '';
        const lastName = emp.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || emp.username || `Unknown (${id})`;
      }
      return `Unknown (${id})`;
    });
  };

  // Send notification
  const sendNotification = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const userId = getUserId();
      if (!userId) {
        setError('User ID not found');
        setLoading(false);
        return;
      }

      // Prepare the payload with targeting information
      const payload = {
        title: formData.title,
        message: formData.message,
        priority: "normal", // Default priority
        target_type: formData.targetType,
        target_departments: formData.targetType === 'department' ? selectedDepartments.map(dept => dept.id || dept) : [],
        target_employees: formData.targetType === 'individual' ? selectedEmployees.map(emp => emp.id || emp) : [],
        notification_type: formData.notificationType // 'general' or 'logout'
      };

      console.log('📤 Sending notification payload:', payload);
      console.log('📤 Selected departments:', selectedDepartments);
      console.log('📤 Selected employees:', selectedEmployees);

      const response = await fetch(`${API_BASE_URL}/pop-notifications/?user_id=${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const responseData = await response.json();
        
        // Show announcement popup to employees (instead of success message)
        const targetCount = formData.targetType === 'individual' ? selectedEmployees.length : 
                           formData.targetType === 'department' ? selectedDepartments.reduce((total, dept) => total + (dept.employee_count || 0), 0) : 
                           10; // Default estimate for 'all'
                           
        showAnnouncementPopup({
          title: formData.title,
          message: formData.message,
          senderName: getCurrentUserName(),
          targetCount: targetCount,
          targetType: formData.targetType,
          priority: "normal",
          notificationId: responseData.id || responseData._id
        });
        
        setFormData({ 
          title: "", 
          message: "", 
          targetType: "all", 
          targetDepartments: [], 
          targetEmployees: [],
          notificationType: "general"
        });
        setSelectedDepartments([]);
        setSelectedEmployees([]);
        setShowCreateForm(false);
        fetchNotifications();
        fetchStats();
        
        // Trigger instant notification check globally so admin sees it immediately
        if (window.triggerNotificationCheck) {
          console.log('🔔 Triggering instant notification check for admin...');
          window.triggerNotificationCheck();
        }

        // Also trigger notification check for all other users via a broadcast mechanism
        // This ensures instant delivery to all targeted users
        triggerInstantNotificationForUsers(formData.targetType, selectedDepartments, selectedEmployees);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to send notification");
      }
    } catch (error) {
      setError(error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Get current user name
  const getCurrentUserName = () => {
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');
      // Try to get full name from first_name and last_name
      const firstName = userData.first_name || '';
      const lastName = userData.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();

      // Return full name if available, otherwise fallback to name, username, or default
      return fullName || userData.name || userData.username || 'Admin User';
    } catch (error) {
      return 'Admin User';
    }
  };

  // Trigger instant notification for targeted users
  const triggerInstantNotificationForUsers = async (targetType, selectedDepartments, selectedEmployees) => {
    try {
      console.log('🚀 Triggering instant notification for users:', { targetType, selectedDepartments, selectedEmployees });

      // For 'all' target type, we can't easily trigger all users individually
      // But we can force a cache refresh by updating a global timestamp
      if (targetType === 'all') {
        const globalNotificationTrigger = {
          type: 'global_notification_created',
          timestamp: Date.now(),
          notificationId: 'pending'
        };
        localStorage.setItem('globalNotificationTrigger', JSON.stringify(globalNotificationTrigger));
        console.log('📢 Global notification trigger set for all users');
        return;
      }

      // For department-specific notifications, we could potentially trigger
      // specific users, but for now we'll use the global trigger
      if (targetType === 'department' && selectedDepartments.length > 0) {
        const globalNotificationTrigger = {
          type: 'department_notification_created',
          timestamp: Date.now(),
          departments: selectedDepartments.map(d => d.id || d),
          notificationId: 'pending'
        };
        localStorage.setItem('globalNotificationTrigger', JSON.stringify(globalNotificationTrigger));
        console.log('📢 Department notification trigger set');
        return;
      }

      // For individual users, we could trigger specific user sessions
      // This would require a more sophisticated approach with WebSockets or SSE
      if (targetType === 'individual' && selectedEmployees.length > 0) {
        const globalNotificationTrigger = {
          type: 'individual_notification_created',
          timestamp: Date.now(),
          userIds: selectedEmployees.map(e => e.id || e),
          notificationId: 'pending'
        };
        localStorage.setItem('globalNotificationTrigger', JSON.stringify(globalNotificationTrigger));
        console.log('📢 Individual notification trigger set for users:', selectedEmployees.length);
        return;
      }

    } catch (error) {
      console.error('Error triggering instant notification:', error);
    }
  };

  // Show announcement popup
  const showAnnouncementPopup = (data) => {
    // Format current date and time
    const now = new Date();
    const options = { 
      timeZone: 'Asia/Kolkata',
      day: '2-digit', 
      month: 'long', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    };
    const timestamp = 'Sent: ' + now.toLocaleDateString('en-IN', options).replace(',', '');
    
    const announcementPayload = {
      ...data,
      acceptedCount: 0, // Initially 0 accepted
      isAcknowledged: false,
      timestamp: timestamp,
      senderRole: data.senderRole || 'ADMIN'
    };
    
    // Store in localStorage for persistence across refreshes
    localStorage.setItem('pendingAnnouncement', JSON.stringify(announcementPayload));
    
    setAnnouncementData(announcementPayload);
    setShowAnnouncementModal(true);
  };

  // Handle announcement acknowledgment
  const handleAnnouncementAcknowledge = async () => {
    if (!announcementData || !announcementData.notificationId) {
      console.error('No notification ID found');
      return;
    }

    try {
      // Show acknowledging state
      setAnnouncementData(prev => ({
        ...prev,
        isAcknowledged: true,
        acceptedCount: prev.acceptedCount + 1
      }));

      // Call backend API to accept notification
      const response = await fetch(`${API_BASE_URL}/pop-notifications/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          notification_id: announcementData.notificationId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to acknowledge notification');
      }

      console.log('✅ Notification acknowledged successfully');

      // Clear localStorage to remove persistent announcement
      localStorage.removeItem('pendingAnnouncement');

      // Close popup after acceptance
      setTimeout(() => {
        setShowAnnouncementModal(false);
        setAnnouncementData(null);
        setSuccess("Announcement acknowledged successfully!");
        
        // Refresh notifications list to update status
        fetchNotifications();
      }, 1500); // Show "Already Acknowledged" for 1.5 seconds before closing

    } catch (error) {
      console.error('Error acknowledging notification:', error);
      setError('Failed to acknowledge notification');
      
      // Revert acknowledged state on error
      setAnnouncementData(prev => ({
        ...prev,
        isAcknowledged: false,
        acceptedCount: Math.max(0, prev.acceptedCount - 1)
      }));
    }
  };

  // Close announcement popup (only used internally after acceptance)
  const closeAnnouncementPopup = () => {
    setShowAnnouncementModal(false);
    setAnnouncementData(null);
  };

  // Deactivate notification
  const deactivateNotification = async (notificationId) => {
    if (!confirm("Are you sure you want to deactivate this notification?")) {
      return;
    }

    try {
      const userId = getUserId();
      if (!userId) {
        setError('User ID not found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/pop-notifications/${notificationId}/deactivate?user_id=${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ reason: "Manually deactivated by admin" }),
      });

      if (response.ok) {
        setSuccess("Notification deactivated successfully!");
        fetchNotifications();
        fetchStats();
      } else {
        throw new Error("Failed to deactivate notification");
      }
    } catch (error) {
      setError(error.message);
      console.error(error);
    }
  };

  // Activate notification  
  const activateNotification = async (notificationId) => {
    if (!confirm("Are you sure you want to activate this notification?")) {
      return;
    }

    try {
      const userId = getUserId();
      if (!userId) {
        setError('User ID not found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/pop-notifications/${notificationId}/activate?user_id=${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ reason: "Manually activated by admin" }),
      });

      if (response.ok) {
        setSuccess("Notification activated successfully!");
        fetchNotifications();
        fetchStats();
      } else {
        throw new Error("Failed to activate notification");
      }
    } catch (error) {
      setError(error.message);
      console.error(error);
    }
  };

  // View notification history
  const viewHistory = async (notificationId) => {
    try {
      const userId = getUserId();
      if (!userId) {
        setError('User ID not found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/pop-notifications/${notificationId}/history?user_id=${userId}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedNotification(data);
        setShowHistory(true);
      } else {
        throw new Error("Failed to fetch notification history");
      }
    } catch (error) {
      setError(error.message);
      console.error(error);
    }
  };

  // Format date to Indian Standard Time (IST)
  const formatDate = (dateString) => {
    return formatDateTime(dateString);
  };

  // Show checkboxes when Select button is clicked
  const handleShowCheckboxes = () => {
    setShowCheckboxes(true);
  };

  // Handle select all functionality
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedNotifications([]);
      setSelectAll(false);
    } else {
      const allIds = notifications.map(n => n.id || n._id);
      setSelectedNotifications(allIds);
      setSelectAll(true);
    }
  };

  // Handle individual notification selection
  const handleSelectNotification = (notificationId, e) => {
    e.stopPropagation(); // Prevent row click event
    if (selectedNotifications.includes(notificationId)) {
      setSelectedNotifications(selectedNotifications.filter(id => id !== notificationId));
      setSelectAll(false);
    } else {
      const newSelected = [...selectedNotifications, notificationId];
      setSelectedNotifications(newSelected);
      // Check if all are now selected
      if (newSelected.length === notifications.length) {
        setSelectAll(true);
      }
    }
  };

  // Clear all selections and hide checkboxes
  const handleCancelSelection = () => {
    setSelectedNotifications([]);
    setSelectAll(false);
    setShowCheckboxes(false);
  };

  // Delete selected notifications
  const handleDeleteSelected = async () => {
    if (selectedNotifications.length === 0) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to PERMANENTLY DELETE ${selectedNotifications.length} notification${selectedNotifications.length !== 1 ? 's' : ''}? This action cannot be undone!`
    );

    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem("token");
      const userId = getUserId();
      
      if (!userId) {
        setError('User ID not found');
        return;
      }
      
      // Immediately update UI by removing deleted items from state
      setNotifications(prevNotifications => 
        prevNotifications.filter(n => !selectedNotifications.includes(n.id || n._id))
      );
      
      // Clear selection and hide toolbar
      setSelectedNotifications([]);
      setSelectAll(false);
      setShowCheckboxes(false);
      
      // Make DELETE API calls with user_id query parameter
      const deletePromises = selectedNotifications.map(id =>
        fetch(`${API_BASE_URL}/pop-notifications/${id}?user_id=${userId}`, {
          method: 'DELETE',
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        })
      );

      const results = await Promise.all(deletePromises);
      
      // Check if all deletions were successful
      const allSuccessful = results.every(res => res.ok);
      
      if (allSuccessful) {
        setSuccess(`Successfully deleted ${selectedNotifications.length} notification${selectedNotifications.length !== 1 ? 's' : ''}`);
      } else {
        setError('Some notifications could not be deleted. Refreshing...');
      }
      
      // Refresh data from server to ensure consistency
      await fetchNotifications();
      await fetchStats();
      
    } catch (error) {
      console.error('Error deleting notifications:', error);
      setError('Failed to delete notifications. Please try again.');
      // Refresh to show actual state
      await fetchNotifications();
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchNotifications();
    fetchStats();
    fetchDepartments();
    fetchEmployees();
  }, []);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // Auto-refresh notifications disabled to prevent unnecessary re-renders
  // Can be re-enabled if real-time updates are needed
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     fetchNotifications();
  //     fetchStats();
  //   }, 10000); // Refresh every 10 seconds
  //   
  //   return () => clearInterval(interval);
  // }, []);

  // NOTE: Global announcement polling and sound are now handled in App.jsx
  // This ensures notifications show on ALL pages, not just the notifications page

  // Prevent Escape key from closing announcement modal
  useEffect(() => {
    if (showAnnouncementModal) {
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          // Do nothing - prevent closing
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showAnnouncementModal]);

  // Handle announcement modal content visibility and scroll behavior
  useEffect(() => {
    if (showAnnouncementModal) {
      const timer = setTimeout(() => {
        const detailsContent = document.getElementById('announcement-details-content');
        const moreBtn = document.getElementById('announcement-more-btn');
        const modal = document.getElementById('announcement-modal');
        const acceptBtn = document.getElementById('announcement-accept-btn');
        const scrollIndicator = document.getElementById('announcement-scroll-indicator');
        const detailsOverlay = document.getElementById('announcement-details-overlay');
        
        if (!detailsContent || !moreBtn || !modal || !acceptBtn) {
          console.error('Announcement modal elements not found');
          return;
        }
        
        let hasReadFullContent = false;
        
        // Check if content is truncated
        const isTruncated = detailsContent.scrollHeight > detailsContent.clientHeight;
        
        console.log('Announcement Modal Debug:', {
          scrollHeight: detailsContent.scrollHeight,
          clientHeight: detailsContent.clientHeight,
          isTruncated: isTruncated
        });
        
        if (isTruncated) {
          // Long content - show more button, hide accept button
          moreBtn.style.display = 'flex';
          acceptBtn.style.display = 'none';
          
          const handleMoreClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isExpanded = detailsContent.classList.contains('expanded');
            
            if (isExpanded) {
              // Collapse
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
              // Expand
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
          
          // Handle scroll behavior
          const handleScroll = () => {
            if (modal.classList.contains('expanded')) {
              const scrollTop = modal.scrollTop;
              const scrollHeight = modal.scrollHeight;
              const clientHeight = modal.clientHeight;
              const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 50;
              
              const shadowOpacity = Math.min(scrollTop / 50, 0.3);
              modal.style.boxShadow = '0 0 30px rgba(66, 165, 245, ' + (0.2 + shadowOpacity) + ')';
              
              if (scrolledToBottom && !hasReadFullContent) {
                hasReadFullContent = true;
                acceptBtn.style.display = 'flex';
                if (scrollIndicator) scrollIndicator.classList.remove('show');
                acceptBtn.style.animation = 'fadeInSuccess 0.5s ease';
              }
            }
          };
          
          modal.addEventListener('scroll', handleScroll);
          
          // Cleanup
          return () => {
            moreBtn.removeEventListener('click', handleMoreClick);
            modal.removeEventListener('scroll', handleScroll);
          };
        } else {
          // Short content - show accept button immediately
          moreBtn.style.display = 'none';
          acceptBtn.style.display = 'flex';
          if (detailsOverlay) detailsOverlay.style.display = 'none';
          hasReadFullContent = true;
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [showAnnouncementModal]);

  const tabCounts = {
    all: notifications.length,
    general: notifications.filter((n) => n.notification_type === 'general').length,
    logout: notifications.filter((n) => n.notification_type === 'logout').length,
  };

  const displayedNotifications = getFilteredNotifications().filter((notification) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      notification.title?.toLowerCase().includes(searchLower) ||
      notification.message?.toLowerCase().includes(searchLower) ||
      notification.sender_name?.toLowerCase().includes(searchLower) ||
      notification.target_type?.toLowerCase().includes(searchLower)
    );
  });

  const renderNotificationAction = (notification, totalTargetUsers, acceptedCount) => {
    if (!notification.is_active) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            activateNotification(notification.id || notification._id);
          }}
          className="ann-action-btn ann-action-btn--start"
          title="Activate Notification"
        >
          START
        </button>
      );
    }
    if (notification.is_active && totalTargetUsers > 0 && acceptedCount === totalTargetUsers) {
      return <span className="ann-action-btn ann-action-btn--done">COMPLETED</span>;
    }
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          deactivateNotification(notification.id || notification._id);
        }}
        className="ann-action-btn ann-action-btn--stop"
        title="Deactivate Notification"
      >
        STOP
      </button>
    );
  };

  return (
    <>
      <style>{announcementPageStyles}</style>
      <div className="task-page-container">
        <div className="task-top-bar">
          <div className="task-top-bar-left">
            <h1>Announcements</h1>
            <p>Manage company-wide announcements and logout notifications</p>
          </div>
          <div className="task-top-bar-right">
            {(permissions.send || isSuperAdmin(getUserPermissions())) && (
              <button type="button" className="task-btn-create" onClick={() => setShowCreateForm(true)}>
                <Plus size={16} />
                Create Announcement
              </button>
            )}
          </div>
        </div>

        <div className="task-view-toggle-bar">
          <div className="task-view-toggle-group">
            <button
              type="button"
              className={`task-view-toggle-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All ({tabCounts.all})
            </button>
            <button
              type="button"
              className={`task-view-toggle-btn ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              General ({tabCounts.general})
            </button>
            <button
              type="button"
              className={`task-view-toggle-btn ${activeTab === 'logout' ? 'active-logout' : ''}`}
              onClick={() => setActiveTab('logout')}
            >
              <Power size={14} />
              Logout ({tabCounts.logout})
            </button>
          </div>

          <div className="task-toolbar-right">
            {(permissions.delete || isSuperAdmin(getUserPermissions())) && (
              !showCheckboxes ? (
                <button type="button" className="task-btn-select" onClick={handleShowCheckboxes}>
                  {selectedNotifications.length > 0 ? `Select (${selectedNotifications.length})` : 'Select'}
                </button>
              ) : (
                <div className="task-select-controls">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      style={{ width: 16, height: 16 }}
                    />
                    Select All
                  </label>
                  <span>{selectedNotifications.length} selected</span>
                  <button
                    type="button"
                    className="task-select-btn-del"
                    onClick={handleDeleteSelected}
                    disabled={selectedNotifications.length === 0}
                  >
                    Delete ({selectedNotifications.length})
                  </button>
                  <button type="button" className="task-select-btn-cancel" onClick={handleCancelSelection}>
                    Cancel
                  </button>
                </div>
              )
            )}

            <div className="task-search-box--in-bar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Search announcements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {success && <div className="task-success-banner">{success}</div>}
        {error && <div className="task-error-banner">{error}</div>}

        <div className="task-data-table-header">
          {showCheckboxes && (
            <div className="task-th checkbox">
              <input type="checkbox" checked={selectAll} onChange={handleSelectAll} style={{ width: 16, height: 16 }} />
            </div>
          )}
          <div className="task-th number">#</div>
          <div className="task-th date">Date & Time</div>
          <div className="task-th created">Created By</div>
          <div className="task-th subject">Subject</div>
          <div className="task-th target">Target</div>
          <div className="task-th progress">Progress</div>
          <div className="task-th action">Action</div>
        </div>

        <div className="task-data-table-body">
          {loading ? (
            <div className="task-loading-spinner">
              <div className="spinner" />
              <p style={{ color: '#6b7a99', margin: 0, fontSize: 14 }}>Loading announcements...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="task-empty-state">
              <Bell size={40} color="#4a5570" style={{ marginBottom: 12 }} />
              <p className="task-empty-state-title">No Announcements Found</p>
              <p className="task-empty-state-sub">Create your first announcement to get started</p>
            </div>
          ) : displayedNotifications.length === 0 ? (
            <div className="task-empty-state">
              <Bell size={40} color="#4a5570" style={{ marginBottom: 12 }} />
              <p className="task-empty-state-title">No Announcements Match Your Search</p>
              <p className="task-empty-state-sub">Try different search terms or tabs</p>
            </div>
          ) : (
            displayedNotifications.map((notification, index) => {
              const stats = notification.acceptance_stats || {};
              const totalTargetUsers = stats.total_users || 0;
              const acceptedCount = stats.accepted_count || 0;
              const pendingCount = Math.max(0, totalTargetUsers - acceptedCount);
              const acceptanceRate = totalTargetUsers > 0 ? (acceptedCount / totalTargetUsers * 100) : 0;
              const notificationId = notification.id || notification._id;
              const isSelected = selectedNotifications.includes(notificationId);
              const isDeactivated = notification.is_active === false;

              return (
                <div
                  key={notificationId}
                  className={`task-row ${isSelected && showCheckboxes ? 'selected' : ''} ${isDeactivated ? 'deactivated' : ''}`}
                  onClick={() => viewHistory(notification.id || notification._id)}
                  title={isDeactivated ? 'Deactivated announcement - Click to view details' : 'Click to view announcement details'}
                >
                  {showCheckboxes && (
                    <div className="task-td checkbox" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectNotification(notificationId, e)}
                        style={{ width: 16, height: 16 }}
                      />
                    </div>
                  )}
                  <div className="task-td number">{index + 1}</div>
                  <div className="task-td date">{formatDate(notification.created_at)}</div>
                  <div className="task-td created">{notification.sender_name || 'Unknown'}</div>
                  <div className="task-td subject">
                    <span className={`ann-type-badge ${notification.notification_type === 'logout' ? 'ann-type-logout' : 'ann-type-general'}`}>
                      {notification.notification_type === 'logout' ? 'Logout' : 'General'}
                    </span>
                    {notification.title}
                    {isDeactivated && <span className="ann-deactivated-badge">DEACTIVATED</span>}
                  </div>
                  <div className="task-td target">
                    {notification.target_type === 'all' && (
                      <span className="ann-target-all">All Employees</span>
                    )}
                    {notification.target_type === 'department' && (
                      <div>
                        <span className="ann-target-dept">Departments</span>
                        <div style={{ fontSize: 11, color: '#6b7a99', marginTop: 2 }}>
                          {getDepartmentNames(notification.target_departments).length > 0
                            ? getDepartmentNames(notification.target_departments).slice(0, 2).join(', ')
                            : `${notification.target_departments?.length || 0} selected`}
                        </div>
                      </div>
                    )}
                    {notification.target_type === 'individual' && (
                      <div>
                        <span className="ann-target-ind">Specific Employees</span>
                        <div style={{ fontSize: 11, color: '#6b7a99', marginTop: 2 }}>
                          {getEmployeeNames(notification.target_employees).length > 0
                            ? getEmployeeNames(notification.target_employees).slice(0, 2).join(', ')
                            : `${notification.target_employees?.length || 0} selected`}
                        </div>
                      </div>
                    )}
                    {!notification.target_type && <span className="ann-target-all">All Employees</span>}
                  </div>
                  <div className="task-td progress">
                    <div className="ann-progress-wrap">
                      <div className="ann-progress-stats">
                        <span className="accepted" title="Accepted">{acceptedCount}</span>
                        <span className="pending" title="Pending">{pendingCount}</span>
                        <span className="total" title="Total">{totalTargetUsers}</span>
                      </div>
                      <div className="ann-progress-bar">
                        <div className="ann-progress-fill" style={{ width: `${acceptanceRate}%` }} />
                      </div>
                      <span className="ann-progress-pct">{acceptanceRate.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="task-td action" onClick={(e) => e.stopPropagation()}>
                    {renderNotificationAction(notification, totalTargetUsers, acceptedCount)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      {/* Create Announcement Modal */}
      {showCreateForm && (
        <div className="task-modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="task-modal-container" onClick={(e) => e.stopPropagation()}>
            <button
              className="task-modal-close"
              onClick={() => setShowCreateForm(false)}
              aria-label="Close"
              type="button"
            >
              ×
            </button>
            <div className="task-modal-header">
              <h2>Create Announcement</h2>
            </div>
            <div className="task-modal-body">
              <form onSubmit={sendNotification}>
              <div className="ann-form-row">
                <div className="flex-1">
                  <label className="ann-form-label">
                    Date & Time
                  </label>
                  <input
                    type="text"
                    className="ann-form-input ann-form-input--readonly"
                    value={formatDate(new Date())}
                    readOnly
                  />
                </div>
                <div className="flex-1">
                  <label className="ann-form-label">
                    Created By
                  </label>
                  <input
                    type="text"
                    className="ann-form-input ann-form-input--readonly"
                    value={getCurrentUserName()}
                    readOnly
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="ann-form-label">
                  Subject *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  onBlur={() => handleBlur('title')}
                  className="ann-form-input"
                  placeholder="Enter announcement subject"
                  required
                />
              </div>

              <div className="mt-4">
                <label className="ann-form-label">
                  Announcment Details *
                </label>
                <textarea
                  ref={notificationDetailsRef}
                  value={formData.message}
                  onChange={handleNotificationDetailsChange}
                  className="ann-form-textarea"
                  rows="3"
                  placeholder="Enter announcement details..."
                  required
                  style={{ minHeight: '80px' }}
                />
              </div>

              <div className="mt-4">
                <label className="ann-form-label">
                  Target Type
                </label>
                <select
                  value={formData.targetType}
                  onChange={(e) => setFormData({ ...formData, targetType: e.target.value })}
                  className="ann-form-input ann-form-input--readonly"
                >
                  <option value="all">All Employees</option>
                  <option value="department">Specific Departments</option>
                  <option value="individual">Individual Employees</option>
                </select>
              </div>

              <div className="mt-4">
                <label className="ann-form-label">
                  Notification Type
                </label>
                <select
                  value={formData.notificationType}
                  onChange={(e) => setFormData({ ...formData, notificationType: e.target.value })}
                  className="ann-form-input ann-form-input--readonly"
                >
                  <option value="general">General Announcement</option>
                  <option value="logout">Logout Announcement</option>
                </select>
                <p className="ann-form-hint">
                  {formData.notificationType === 'logout' 
                    ? '⚠️ Logout notifications will show a logout button to users. Users will be logged out when they acknowledge.'
                    : '📢 General announcements for standard communications.'
                  }
                </p>
              </div>

              {/* Department Selection */}
              {formData.targetType === 'department' && (
                <div className="mt-4">
                  <label className="ann-form-label">
                    Select Departments
                  </label>
                  <div className="relative z-[10000]" ref={departmentDropdownRef}>
                    <div 
                      className="ann-dropdown-trigger"
                      onClick={() => {
                        if (!showDepartmentDropdown) {
                          calculateDropdownPosition(departmentDropdownRef, setDepartmentDropdownOpenUp, setDepartmentDropdownPosition);
                        }
                        setShowDepartmentDropdown(!showDepartmentDropdown);
                        if (showDepartmentDropdown) {
                          setDepartmentSearch(""); // Clear search when closing
                        }
                      }}
                    >
                      {selectedDepartments.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedDepartments.map((dept, index) => (
                            <span key={dept.id || index} className="bg-cyan-500 text-white px-2 py-1 rounded-full text-sm flex items-center gap-1">
                              {dept.name || dept}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDepartments(selectedDepartments.filter(d => (d.id || d) !== (dept.id || dept)));
                                }}
                                className="text-white hover:text-gray-300"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500">Select departments...</span>
                      )}
                      <ChevronDown className={`transform transition-transform ${showDepartmentDropdown ? 'rotate-180' : ''} text-gray-600`} size={20} />
                    </div>
                    {showDepartmentDropdown && (
                      <div 
                        className="ann-dropdown-panel"
                        style={{
                          top: `${departmentDropdownPosition.top}px`,
                          left: `${departmentDropdownPosition.left}px`,
                          width: `${departmentDropdownPosition.width}px`,
                          zIndex: 10001,
                          maxHeight: '280px'
                        }}
                      >
                        {/* Search Bar */}
                        <div className="ann-dropdown-search">
                          <input
                            type="text"
                            placeholder="Search departments..."
                            value={departmentSearch}
                            onChange={(e) => setDepartmentSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="ann-form-input"
                          />
                        </div>
                        
                        {/* Scrollable List */}
                        <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
                          {filteredDepartments.length > 0 ? filteredDepartments.map((dept) => {
                            const deptName = dept.name || dept.department_name || dept.title || 'Unknown Department';
                            const deptId = dept.id || dept._id || dept.department_id;
                            const deptData = { id: deptId, name: deptName };
                            const isSelected = selectedDepartments.some(d => d.id === deptId);
                            
                            return (
                              <div
                                key={deptId}
                                className="ann-dropdown-item"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedDepartments(selectedDepartments.filter(d => d.id !== deptId));
                                  } else {
                                    setSelectedDepartments([...selectedDepartments, deptData]);
                                  }
                                }}
                              >
                                <div className={`w-4 h-4 border-2 border-gray-400 rounded ${isSelected ? 'bg-cyan-500 border-cyan-500' : ''} flex items-center justify-center`}>
                                  {isSelected && <span className="text-white text-xs">✓</span>}
                                </div>
                                <span className="text-black font-medium">{deptName}</span>
                              </div>
                            );
                          }) : (
                            <div className="ann-user-empty">
                              {departmentSearch ? 'No departments found matching your search' : (departments.length === 0 ? 'Loading departments...' : 'No departments found')}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Employee Selection */}
              {formData.targetType === 'individual' && (
                <div className="mt-4">
                  <label className="ann-form-label">
                    Select Employees
                  </label>
                  <div className="relative z-[10000]" ref={employeeDropdownRef}>
                    <div 
                      className="ann-dropdown-trigger"
                      onClick={() => {
                        if (!showEmployeeDropdown) {
                          calculateDropdownPosition(employeeDropdownRef, setEmployeeDropdownOpenUp, setEmployeeDropdownPosition);
                        }
                        setShowEmployeeDropdown(!showEmployeeDropdown);
                        if (showEmployeeDropdown) {
                          setEmployeeSearch(""); // Clear search when closing
                        }
                      }}
                    >
                      {selectedEmployees.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedEmployees.map((emp, index) => (
                            <span key={emp.id || index} className="bg-cyan-500 text-white px-2 py-1 rounded-full text-sm flex items-center gap-1">
                              {emp.name || emp}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEmployees(selectedEmployees.filter(e => (e.id || e) !== (emp.id || emp)));
                                }}
                                className="text-white hover:text-gray-300"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500">Select employees...</span>
                      )}
                      <ChevronDown className={`transform transition-transform ${showEmployeeDropdown ? 'rotate-180' : ''} text-gray-600`} size={20} />
                    </div>
                    {showEmployeeDropdown && (
                      <div 
                        className="ann-dropdown-panel"
                        style={{
                          top: `${employeeDropdownPosition.top}px`,
                          left: `${employeeDropdownPosition.left}px`,
                          width: `${employeeDropdownPosition.width}px`,
                          zIndex: 10001,
                          maxHeight: '280px'
                        }}
                      >
                        {/* Search Bar */}
                        <div className="ann-dropdown-search">
                          <input
                            type="text"
                            placeholder="Search employees..."
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="ann-form-input"
                          />
                        </div>

                        {/* Scrollable List */}
                        <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
                          {filteredEmployees.length > 0 ? filteredEmployees.map((emp) => {
                            const empName = emp.name || emp.full_name || emp.username || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unknown User';
                            const empId = emp.id || emp._id || emp.user_id;
                            const displayName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.name || emp.username || 'Unknown User';
                            const empData = { id: empId, name: displayName };
                            const isSelected = selectedEmployees.some(e => e.id === empId);
                            
                            return (
                              <div
                                key={empId}
                                className="ann-dropdown-item"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedEmployees(selectedEmployees.filter(e => e.id !== empId));
                                  } else {
                                    setSelectedEmployees([...selectedEmployees, empData]);
                                  }
                                }}
                              >
                                <div className={`w-4 h-4 border-2 border-gray-400 rounded ${isSelected ? 'bg-cyan-500 border-cyan-500' : ''} flex items-center justify-center`}>
                                  {isSelected && <span className="text-white text-xs">✓</span>}
                                </div>
                                <span className="text-black font-medium">{displayName}</span>
                              </div>
                            );
                          }) : (
                            <div className="ann-user-empty">
                              {employeeSearch ? 'No matching employees found' : (employees.length === 0 ? 'Loading employees...' : 'No employees found')}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="ann-form-actions">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="task-btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="task-btn-create"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Create Announcement
                    </>
                  )}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && selectedNotification && (
        <div className="task-modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="task-modal-container task-modal-container--wide" onClick={(e) => e.stopPropagation()}>
            <button
              className="task-modal-close"
              onClick={() => setShowHistory(false)}
              aria-label="Close"
              type="button"
            >
              ×
            </button>
            <div className="task-modal-header">
              <h2>Announcement Details</h2>
            </div>
            <div className="task-modal-body">

            {/* Notification Details Form */}
            <div className="ann-form-row">
              <div className="flex-1">
                <label className="ann-form-label">
                  Title
                </label>
                <input
                  type="text"
                  className="ann-form-input ann-form-input--readonly"
                  value={selectedNotification.title || ''}
                  readOnly
                />
              </div>
              <div className="flex-1">
                <label className="ann-form-label">
                  Priority
                </label>
                <input
                  type="text"
                  className="ann-form-input ann-form-input--readonly"
                  value={selectedNotification.priority ? selectedNotification.priority.toUpperCase() : ''}
                  readOnly
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="ann-form-label">
                Message
              </label>
              <textarea
                className="ann-form-textarea ann-form-input--readonly"
                rows={3}
                value={selectedNotification.message || ''}
                readOnly
                style={{
                  minHeight: "3rem",
                  maxHeight: "400px",
                }}
              />
            </div>

            <div className="ann-form-row" style={{ marginTop: 16 }}>
              <div className="flex-1">
                <label className="ann-form-label">
                  Sent By
                </label>
                <input
                  type="text"
                  className="ann-form-input ann-form-input--readonly"
                  value={selectedNotification.sender_name || 'Unknown'}
                  readOnly
                />
              </div>
              <div className="flex-1">
                <label className="ann-form-label">
                  Date & Time
                </label>
                <input
                  type="text"
                  className="ann-form-input ann-form-input--readonly"
                  value={formatDate(selectedNotification.created_at)}
                  readOnly
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="ann-form-label">
                Target Type
              </label>
              <input
                type="text"
                className="ann-form-input ann-form-input--readonly"
                value={
                  selectedNotification.target_type === 'all' ? 'All Employees' :
                  selectedNotification.target_type === 'department' ? `Departments (${selectedNotification.target_departments?.length || 0} selected)` :
                  selectedNotification.target_type === 'individual' ? `Specific Employees (${selectedNotification.target_employees?.length || 0} selected)` :
                  'All Employees'
                }
                readOnly
              />
            </div>

            {/* Statistics */}
            <div className="ann-stat-grid">
              <div className="ann-stat-card ann-stat-accepted">
                <CheckCircle2 size={28} color="#34d399" />
                <div>
                  <p>Accepted</p>
                  <span>{selectedNotification.accepted_by?.length || 0}</span>
                </div>
              </div>
              <div className="ann-stat-card ann-stat-pending">
                <Clock size={28} color="#fbbf24" />
                <div>
                  <p>Pending</p>
                  <span>{selectedNotification.pending_users?.length || 0}</span>
                </div>
              </div>
              <div className="ann-stat-card ann-stat-rate">
                <BarChart3 size={28} color="#60a5fa" />
                <div>
                  <p>Acceptance Rate</p>
                  <span>
                    {selectedNotification.total_active_users > 0 
                      ? ((selectedNotification.accepted_by?.length || 0) / selectedNotification.total_active_users * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Accepted Users */}
            <div className="mb-6">
              <label className="ann-form-label">
                Accepted Users ({selectedNotification.accepted_by?.length || 0})
              </label>
              <div className="ann-user-list">
                {selectedNotification.accepted_by?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedNotification.accepted_by.map((acceptance, index) => (
                      <div key={index} className="ann-user-row">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                          <span className="font-medium text-sm" style={{ color: "#c8d0e0" }}>{acceptance.user_name}</span>
                        </div>
                        <span className="text-xs" style={{ color: "#6b7a99" }}>
                          {formatDate(acceptance.accepted_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ann-user-empty">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No acceptances yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pending Users */}
            <div>
              <label className="ann-form-label">
                Pending Users ({selectedNotification.pending_users?.length || 0})
              </label>
              <div className="ann-user-list">
                {selectedNotification.pending_users && selectedNotification.pending_users.length > 0 ? (
                  <div className="space-y-2">
                    {selectedNotification.pending_users.map((user, idx) => (
                      <div key={user.user_id || idx} className="ann-user-row">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse"></div>
                          <span className="font-medium text-sm" style={{ color: "#c8d0e0" }}>{user.user_name}</span>
                        </div>
                        <span className="text-xs" style={{ color: "#fbbf24" }}>Waiting for response</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ann-user-empty">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">All users have accepted this announcement!</p>
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Announcement Popup Modal - MOVED TO APP.JSX FOR GLOBAL ACCESS */}
      {/* This modal now shows on ALL pages, not just the notifications page */}
      {/* The modal is rendered globally in App.jsx and controlled via localStorage */}
    </>
  );
};

export default NotificationManagementPage;