"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, Download, Calendar, X, Frown, User, Send, Plus, Trash2, History } from "lucide-react"
import axios from "axios"
import { formatDateTime, getISTToday } from '../utils/dateUtils';
import hrmsService from '../services/hrmsService';
import CurrencyInput from './common/CurrencyInput';
import PaidLeaveManagement from './attendance/PaidLeaveManagement';
import useTabWithHistory from '../hooks/useTabWithHistory';
import useNavbarPageSearch from '../hooks/useNavbarPageSearch';
// import jsPDF from "jspdf"
// import "jspdf-autotable"
// Import simplified permission system
import { 
  getPermissionLevel, 
  canViewAll, 
  canViewJunior, 
  canCreate, 
  canEdit, 
  canDelete,
  getPermissionDisplayText,
  getCurrentUserId,
  debugPermissions,
  hasAttendancePermission,
  hasPermission,
  isSuperAdmin,
  getUserPermissions
} from '../utils/permissions';

// API Configuration
const BASE_URL = '/api'

// Render above sticky attendance table headers and main scroll container.
const ATTENDANCE_MODAL_Z_INDEX = 10050

const attendancePageStyles = `
  .attendance-page { padding: 0; max-width: 100%; background: #000; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Lexend Deca', sans-serif; color: #e2e8f0; }
  .attendance-page .task-top-bar { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 24px 0; border-bottom: 1px solid #1f1f27; background: #000; gap: 16px; flex-wrap: wrap; }
  .attendance-page .task-top-bar-left h1 { font-size: 22px; font-weight: 700; color: #f0f0f5; margin: 0 0 2px; line-height: 1.2; }
  .attendance-page .task-top-bar-left p { font-size: 13px; color: #c8d0e0; margin: 0 0 12px; }
  .attendance-page .task-top-bar-right { display: flex; gap: 8px; align-items: center; padding-top: 4px; flex-wrap: wrap; }
  .attendance-page .task-btn-secondary { background: #1a1a24; color: #c8d0e0; border: 1px solid #2a2a3a; padding: 7px 14px; border-radius: 3px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.15s, border-color 0.15s; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; }
  .attendance-page .task-btn-secondary:hover:not(:disabled) { background: #22222e; border-color: #3a3a50; }
  .attendance-page .task-btn-secondary:disabled { opacity: 0.4; cursor: default; }
  .attendance-page .task-view-toggle-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 24px; background: #000; border-bottom: 1px solid #1f1f27; flex-wrap: wrap; }
  .attendance-page .task-view-toggle-group { display: flex; gap: 0; flex-wrap: wrap; min-width: 0; overflow-x: auto; scrollbar-width: none; }
  .attendance-page .task-view-toggle-group::-webkit-scrollbar { display: none; }
  .attendance-page .task-view-toggle-btn { padding: 12px 16px; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #c8d0e0; cursor: pointer; border-bottom: 3px solid transparent; transition: color 0.15s, border-color 0.15s; white-space: nowrap; }
  .attendance-page .task-view-toggle-btn:hover { color: #c8d0e0; }
  .attendance-page .task-view-toggle-btn.active { color: #f97316; font-weight: 800; border-bottom-color: #f97316; }
  .attendance-page .task-toolbar-right { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-left: auto; flex-shrink: 0; flex-wrap: wrap; }
  .attendance-page .attendance-month-nav { display: inline-flex; align-items: center; gap: 4px; background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 3px; padding: 4px 6px; }
  .attendance-page .attendance-month-label { font-size: 13px; font-weight: 600; color: #f0f0f5; min-width: 140px; text-align: center; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
  .attendance-page .attendance-page-content { padding: 16px 24px 24px; }
  .attendance-page .attendance-legend { display: flex; justify-content: center; gap: 20px; margin-bottom: 16px; flex-wrap: wrap; padding: 8px 0; }
  .attendance-page .attendance-legend-item { display: flex; align-items: center; gap: 8px; }
  .attendance-page .attendance-legend-label { color: #c8d0e0; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
  .attendance-page .attendance-kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0; border: 1px solid #1f1f27; border-radius: 4px; overflow: hidden; margin-bottom: 16px; background: #000; }
  .attendance-page .attendance-kpi { padding: 12px 14px; border-right: 1px solid #1f1f27; min-width: 0; }
  .attendance-page .attendance-kpi:last-child { border-right: none; }
  .attendance-page .attendance-kpi-label { font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #c8d0e0; margin-bottom: 4px; white-space: nowrap; }
  .attendance-page .attendance-kpi-val { font-size: 20px; font-weight: 800; line-height: 1; margin-bottom: 3px; }
  .attendance-page .attendance-kpi-sub { font-size: 10px; font-weight: 500; color: #c8d0e0; white-space: nowrap; }
  .attendance-page .attendance-kpi-bar { height: 2px; background: #1a1a24; border-radius: 2px; margin-top: 6px; overflow: hidden; }
  .attendance-page .attendance-kpi-bar-fill { height: 100%; border-radius: 2px; }
  .attendance-page .task-search-box--in-bar { position: relative; width: 220px; min-width: 180px; flex-shrink: 0; }
  .attendance-page .task-search-box--in-bar input { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 3px; padding: 7px 12px 7px 34px; color: #c8d0e0; font-size: 13px; width: 100%; outline: none; box-sizing: border-box; }
  .attendance-page .task-search-box--in-bar input::placeholder { color: #8898b8; }
  .attendance-page .task-search-box--in-bar input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .attendance-page .task-search-box--in-bar .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #c8d0e0; pointer-events: none; display: flex; }
  .attendance-page .attendance-filter-dropdown { position: relative; min-width: 140px; flex-shrink: 0; }
  .attendance-page .attendance-filter-trigger { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 3px; padding: 7px 28px 7px 10px; color: #c8d0e0; font-size: 13px; cursor: pointer; outline: none; user-select: none; position: relative; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-height: 34px; box-sizing: border-box; display: flex; align-items: center; }
  .attendance-page .attendance-filter-trigger.placeholder { color: #8898b8; }
  .attendance-page .attendance-filter-trigger.open { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .attendance-page .attendance-filter-chevron { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: #c8d0e0; transition: transform 0.2s; pointer-events: none; }
  .attendance-page .attendance-filter-chevron.open { transform: translateY(-50%) rotate(180deg); }
  .attendance-page .attendance-filter-menu { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #0a0a0f; border: 1px solid #2a2a3a; border-radius: 3px; z-index: 1000; box-shadow: 0 8px 24px rgba(0,0,0,0.7); min-width: 160px; }
  .attendance-page .attendance-filter-menu-search { padding: 6px 8px; border-bottom: 1px solid #1f1f27; }
  .attendance-page .attendance-filter-menu-search input { width: 100%; background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 3px; padding: 5px 8px; color: #c8d0e0; font-size: 12px; outline: none; box-sizing: border-box; }
  .attendance-page .attendance-filter-option { padding: 8px 12px; cursor: pointer; font-size: 13px; color: #c8d0e0; border-bottom: 1px solid #1a1a22; transition: background 0.1s; }
  .attendance-page .attendance-filter-option:hover { background: #13131c; }
  .attendance-page .attendance-filter-option.selected { color: #93c5fd; background: rgba(59,130,246,0.08); }
  .attendance-page .attendance-filter-meta { font-size: 12px; color: #c8d0e0; white-space: nowrap; padding: 6px 10px; border: 1px solid #2a2a3a; border-radius: 3px; background: #1a1a24; }
  .attendance-page .attendance-table-shell { border: 1px solid #1f1f27; border-radius: 4px; overflow: hidden; background: #000; }
  .attendance-page .attendance-table-shell thead { background: #ffffff; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); border-bottom: 2px solid #e5e7eb; }
  .attendance-page .attendance-table-shell tbody td { color: #ffffff; font-weight: 600; padding-top: 5px !important; padding-bottom: 5px !important; white-space: nowrap; }
  .attendance-page .attendance-table-shell tbody tr { border-bottom: 1px solid #2a2a38; }
  .attendance-page .attendance-table-head-group { background: #ffffff !important; color: #03b0f5 !important; border: 1px solid #e5e7eb !important; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 5px 8px !important; }
  .attendance-page .attendance-table-head-col { background: #ffffff !important; color: #03b0f5 !important; border: 1px solid #e5e7eb !important; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px; padding: 5px 8px !important; }
  .attendance-page .attendance-table-head-day { background: #ffffff !important; color: #03b0f5 !important; border: 1px solid #e5e7eb !important; font-weight: 800; text-align: center; padding: 5px 4px !important; }
  .attendance-page .attendance-table-head-col.sortable:hover { background: #f9fafb !important; }
  .attendance-page .attendance-table-scroll-bar { display: flex; align-items: center; justify-content: flex-end; gap: 4px; padding: 4px 10px; border-bottom: 1px solid #1f1f27; background: #000; }
  .attendance-page .attendance-table-scroll-btn { background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 3px; color: #c8d0e0; cursor: pointer; padding: 3px 8px; font-size: 12px; display: flex; align-items: center; transition: background 0.15s; }
  .attendance-page .attendance-table-scroll-btn:hover:not(:disabled) { background: #22222e; }
  .attendance-page .attendance-table-scroll-btn:disabled { opacity: 0.35; cursor: default; }
  .attendance-page .task-loading-spinner { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px 20px; min-height: 50vh; }
  .attendance-page .task-loading-spinner .spinner { width: 32px; height: 32px; border: 3px solid #1a1a24; border-top-color: #3b82f6; border-radius: 50%; animation: attendanceSpin 0.7s linear infinite; margin-bottom: 12px; }
  .attendance-page .task-loading-spinner p { color: #c8d0e0; font-size: 14px; margin: 0; }
  .attendance-page .task-error-state { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px 20px; min-height: 50vh; text-align: center; }
  .attendance-page .task-error-state p { color: #f87171; font-size: 15px; margin: 0 0 12px; }
  .attendance-page .task-btn-retry { background: #3b82f6; color: #fff; border: none; padding: 8px 16px; border-radius: 3px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .attendance-page .task-btn-retry:hover { background: #2563eb; }
  @keyframes attendanceSpin { to { transform: rotate(360deg); } }
`

// Helper function to get user data
const getUserData = () => {
  const userData = localStorage.getItem('userData');
  return userData ? JSON.parse(userData) : null;
};

// Helper function to create authenticated headers
const getAuthHeaders = () => {
  const user = getUserData();
  return {
    'Content-Type': 'application/json',
    ...(user?.token && { 'Authorization': `Bearer ${user.token}` })
  };
};

// API Functions
const attendanceAPI = {
  // Get attendance calendar for a specific month
  getCalendar: async (year, month, userId) => {
    try {
      const response = await axios.get(`${BASE_URL}/attendance/calendar`, {
        params: {
          year,
          month,
          user_id: userId,
          _t: Date.now()  // Cache-busting timestamp
        },
        headers: getAuthHeaders()
      })
      console.log('📅 Calendar data loaded:', response.data);
      return response.data
    } catch (error) {
      console.error('Error fetching attendance calendar:', error)
      throw error
    }
  },

  // Get attendance permissions
  getPermissions: async (userId) => {
    try {
      const response = await axios.get(`${BASE_URL}/attendance/permissions`, {
        params: { user_id: userId },
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error fetching permissions:', error)
      throw error
    }
  },

  // Get attendance statistics
  getStats: async (targetUserId, userId, startDate, endDate) => {
    try {
      const response = await axios.get(`${BASE_URL}/attendance/stats/${targetUserId}`, {
        params: {
          user_id: userId,
          start_date: startDate,
          end_date: endDate
        },
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error fetching stats:', error)
      throw error
    }
  },

  // Get attendance detail for specific date
  getAttendanceDetail: async (userId, dateStr, requesterId) => {
    try {
      const response = await axios.get(`${BASE_URL}/attendance/detail/${userId}/${dateStr}`, {
        params: { user_id: requesterId },
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error fetching attendance detail:', error)
      throw error
    }
  },

  // Edit attendance record
  editAttendance: async (attendanceId, editData, requesterId) => {
    try {
      const response = await axios.put(`${BASE_URL}/attendance/edit/${attendanceId}?admin_id=${requesterId}`, {
        ...editData
      }, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error editing attendance:', error)
      throw error
    }
  },

  // Mark attendance
  markAttendance: async (attendanceData, requesterId) => {
    try {
      const response = await axios.post(`${BASE_URL}/attendance/mark?user_id=${requesterId}`, {
        employee_id: attendanceData.employee_id,
        date: attendanceData.date,
        status: attendanceData.status,
        comments: attendanceData.comments || '',
        reason: attendanceData.reason || '',
        check_in_time: attendanceData.check_in_time || null,
        check_out_time: attendanceData.check_out_time || null,
        is_holiday: attendanceData.is_holiday || false
      }, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error marking attendance:', error)
      throw error
    }
  },

  // Add comment to attendance
  addComment: async (userId, date, content, requesterId) => {
    try {
      const response = await axios.post(`${BASE_URL}/attendance/comments/add?user_id=${userId}&date=${date}&content=${encodeURIComponent(content)}&requester_id=${requesterId}`, {}, {
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error adding comment:', error)
      throw error
    }
  },

  // Get comments for attendance
  getComments: async (userId, date, requesterId) => {
    try {
      const response = await axios.get(`${BASE_URL}/attendance/comments/${userId}/${date}`, {
        params: { requester_id: requesterId },
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error getting comments:', error)
      throw error
    }
  },

  // Get history for attendance
  getHistory: async (userId, date, requesterId) => {
    try {
      const response = await axios.get(`${BASE_URL}/attendance/history/${userId}/${date}`, {
        params: { requester_id: requesterId },
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error getting history:', error)
      throw error
    }
  },

  // Get user attendance history
  getUserHistory: async (userId, requesterId, startDate = null, endDate = null, limit = 50) => {
    try {
      const params = { requester_id: requesterId, limit };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await axios.get(`${BASE_URL}/attendance/history/${userId}`, {
        params,
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error getting user history:', error)
      throw error
    }
  },

  getEditCounts: async (mongoIds, startDate, endDate, requesterId) => {
    try {
      const response = await axios.get(`${BASE_URL}/attendance/edit-counts`, {
        params: {
          user_ids: mongoIds.join(','),
          start_date: startDate,
          end_date: endDate,
          requester_id: requesterId
        },
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error getting edit counts:', error)
      return { counts: {} }
    }
  },


  // Holiday Management APIs
  getHolidays: async (year = null, month = null, userId) => {
    try {
      const params = { user_id: userId };
      if (year) params.year = year;
      if (month) params.month = month;

      const response = await axios.get(`${BASE_URL}/attendance/holidays`, {
        params,
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error getting holidays:', error)
      throw error
    }
  },

  addHoliday: async (name, date, description, userId) => {
    try {
      const params = {
        name,
        date,
        user_id: userId
      };
      if (description) params.description = description;

      const response = await axios.post(`${BASE_URL}/attendance/holidays/add`, null, {
        params,
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error adding holiday:', error)
      throw error
    }
  },

  updateHoliday: async (holidayId, name, date, description, userId) => {
    try {
      const params = { user_id: userId };
      if (name) params.name = name;
      if (date) params.date = date;
      if (description) params.description = description;

      const response = await axios.put(`${BASE_URL}/attendance/holidays/${holidayId}`, null, {
        params,
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error updating holiday:', error)
      throw error
    }
  },

  deleteHoliday: async (holidayId, userId, resetAttendance = true) => {
    try {
      const response = await axios.delete(`${BASE_URL}/attendance/holidays/${holidayId}`, {
        params: { user_id: userId, reset_attendance: resetAttendance },
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error deleting holiday:', error)
      throw error
    }
  },

  checkHoliday: async (date, userId) => {
    try {
      const response = await axios.get(`${BASE_URL}/attendance/holidays/check/${date}`, {
        params: { user_id: userId },
        headers: getAuthHeaders()
      })
      return response.data
    } catch (error) {
      console.error('Error checking holiday:', error)
      throw error
    }
  }
}

const looksLikeRawId = (val) => {
  if (val === null || val === undefined) return false
  const s = String(val).trim()
  if (!s) return false
  // MongoDB ObjectId (24 hex chars)
  if (/^[a-f0-9]{24}$/i.test(s)) return true
  // Pure numeric IDs of any length (050, 12345, etc.)
  if (/^\d+$/.test(s)) return true
  // Employee codes like RM001, RM050, EMP001, etc.
  if (/^(RM|EMP)\d+$/i.test(s)) return true
  return false
}

const normalizeDateKey = (raw) => {
  if (!raw) return null
  if (typeof raw === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    if (raw.includes('T')) {
      const datePart = raw.split('T')[0]
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart
    }
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const getDisplayEmployeeName = (emp) => {
  if (!emp) return 'Employee'
  const candidates = [
    emp.name,
    emp.employee_name,
    emp.full_name,
    [emp.first_name, emp.last_name].filter(Boolean).join(' ').trim(),
    emp.username,
    emp.employeeId,
    emp.employee_id,
    emp.id,
  ]
  for (const c of candidates) {
    const txt = String(c || '').trim()
    if (!txt) continue
    if (looksLikeRawId(txt)) continue
    return txt
  }
  return String(emp.employeeId || emp.employee_id || emp.id || 'Employee')
}

const getDisplayEditorName = (entry) => {
  const candidates = [
    entry?.created_by_name,
    entry?.changed_by_name,
    entry?.editor_name,
    entry?.details?.editor_name,
    entry?.details?.changed_by_name,
    entry?.details?.created_by_name,
    entry?.created_by,
    entry?.changed_by,
  ]
  for (const c of candidates) {
    const txt = String(c || '').trim()
    if (!txt) continue
    if (looksLikeRawId(txt)) continue
    return txt
  }
  // Context-aware fallback — never show raw 'System'
  const actionStr = String(entry?.action_type || entry?.action || entry?.action_description || '').toLowerCase()
  if (actionStr.includes('auto') || actionStr.includes('cron') || actionStr.includes('scheduler')) {
    return 'CRM Auto'
  }
  return 'HR Admin'
}

const humanizeAttendanceField = (field) => {
  const f = String(field || '').trim().toLowerCase()
  if (f === 'check_in_time') return 'Check-in time'
  if (f === 'check_out_time') return 'Check-out time'
  if (f === 'status') return 'Status'
  if (f === 'comments') return 'Auto remark'
  if (f === 'reason') return 'Reason'
  return String(field || 'Field')
}

const toSimpleChangeRemark = ({ field, oldVal, newVal }) => {
  const label = humanizeAttendanceField(field)
  const oldText = oldVal === null || oldVal === undefined || oldVal === '' || oldVal === 'None' ? 'empty' : String(oldVal)
  const newText = newVal === null || newVal === undefined || newVal === '' || newVal === 'None' ? 'empty' : String(newVal)
  if (String(field || '').toLowerCase() === 'status') {
    const statusLabel = (v) => {
      const n = parseFloat(v)
      if (n === 1 || v === 'P') return 'Full Day'
      if (n === 0.5 || v === 'HD') return 'Half Day'
      if (n === 0 || v === 'LV') return 'Leave'
      if (n === -1 || v === 'A') return 'Absent'
      if (n === -2 || v === 'AB') return 'Absconding'
      return String(v ?? '—')
    }
    return `${label} changed from ${statusLabel(oldVal)} to ${statusLabel(newVal)}.`
  }
  return `${label} changed from ${oldText} to ${newText}.`
}

const getStatusBadge = (status, leaveStatus = null) => {
  const pill = (bg, color, text, extraStyle = {}) => (
    <span style={{width:'32px',height:'20px',borderRadius:'12px',backgroundColor:bg,color:color,fontWeight:700,fontSize:'11px',display:'inline-flex',alignItems:'center',justifyContent:'center',...extraStyle}}>{text}</span>
  )

  // Pending leave: neutral gray pill "0"
  if (leaveStatus === 'pending') {
    return pill('#d4d4d8', '#18181b', '0')
  }
  // Rejected leave: absconding style
  if (leaveStatus === 'rejected') {
    return pill('#ff2a2a', '#ffffff', '-1')
  }

  switch (status) {
    case "P":
      return pill('#10b981', '#000000', '1')
    case "L":
      // Late = still counts as present
      return pill('#10b981', '#000000', '1')
    case "LV":
      return pill('#ff7b00', '#000000', '0')
    case "H":
      return pill('#06b6d4', '#000000', '1')
    case "SP":
      // Sunday Paid — full week present, Sunday is paid
      return pill('#06b6d4', '#000000', '1')
    case "S0":
      // Sunday Zero — Monday absconding, Sunday = 0
      return pill('#18181b', '#ffffff', '0')
    case "HD":
      return pill('#ffdd00', '#000000', '0.5')
    case "AB":
      return pill('#ff2a2a', '#ffffff', '-1')
    case "A":
      return pill('#ffffff', '#000000', '0')
    case "WK":
      // Checked-in / Working — blue pulse animation
      return pill('#3b82f6', '#ffffff', 'IN', {animation:'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite'})
    case "W":
      return <span style={{width:'32px',height:'20px',borderRadius:'12px',backgroundColor:'#18181b',color:'#52525b',fontWeight:700,fontSize:'11px',display:'inline-flex',alignItems:'center',justifyContent:'center'}}>—</span>
    default:
      return <span style={{width:'32px',height:'20px',display:'inline-flex'}}></span>
  }
}

// Format 24h time string (HH:MM:SS or HH:MM) to 12h AM/PM
const formatTime12h = (timeStr) => {
  if (!timeStr || timeStr === '—') return '—'
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr
  let h = parseInt(parts[0], 10)
  const m = parts[1]
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${m} ${ampm}`
}

const getStatusText = (status) => {
  switch (status) {
    case "P":
      return "PRESENT"
    case "L":
      return "LATE"
    case "LV":
      return "LEAVE"
    case "H":
      return "HOLIDAY"
    case "SP":
      return "SUNDAY PAID"
    case "S0":
      return "SUNDAY ZERO"
    case "HD":
      return "HALF DAY"
    case "AB":
      return "ABSCONDING"
    case "A":
      return "ABSENT"
    case "WK":
      return "CHECKED IN"
    default:
      return "NOT MARKED"
  }
}

const getDayName = (year, month, day) => {
  const date = new Date(year, month - 1, day)
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  return dayNames[date.getDay()]
}

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

// Sample comments data
const sampleComments = [
  {
    id: 1,
    user: "Admin User",
    message: "Employee was sick today, medical leave approved.",
    timestamp: "2025-01-15 10:30 AM",
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: 2,
    user: "HR Manager",
    message: "Attendance updated as per manager's request.",
    timestamp: "2025-01-15 02:15 PM",
    avatar: "/placeholder.svg?height=40&width=40",
  },
]

const exportToPDF = async (attendanceData, selectedYear, selectedMonth, holidays) => {
  const ExcelJS = (await import('exceljs')).default
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()

  // ── Color map: status → { bg/font ARGB (UPPERCASE), numeric value } ──
  // Using UPPERCASE ARGB + bgColor for maximum Excel compatibility
  const fill = (hex) => ({
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: hex.toUpperCase() },
    bgColor: { argb: hex.toUpperCase() },
  })

  const STATUS_STYLE = {
    P:  { fillHex: '10B981', font: '000000', val: 1    },  // green  → 1
    L:  { fillHex: '10B981', font: '000000', val: 1    },  // green  → 1 (late = full present)
    LV: { fillHex: 'FF7B00', font: '000000', val: 0    },  // orange → 0
    H:  { fillHex: '06B6D4', font: '000000', val: 1    },  // cyan   → 1
    SP: { fillHex: '06B6D4', font: '000000', val: 1    },  // cyan   → 1
    S0: { fillHex: '18181B', font: 'FFFFFF', val: 0    },  // dark   → 0
    HD: { fillHex: 'FFDD00', font: '000000', val: 0.5  },  // yellow → 0.5
    AB: { fillHex: 'FF2A2A', font: 'FFFFFF', val: -1   },  // red    → -1
    A:  { fillHex: 'F5F5F5', font: '000000', val: 0    },  // white  → 0
    WK: { fillHex: '3B82F6', font: 'FFFFFF', val: 'IN' },  // blue   → IN
    W:  { fillHex: '111113', font: '52525B', val: '—'  },  // weekend
  }

  const getStyle = (status) => STATUS_STYLE[status] || { fillHex: '1A1A1A', font: '71717A', val: '' }

  // ExcelJS border helper
  const border = (color = '1F1F22') => ({
    top:    { style: 'thin', color: { argb: 'FF' + color.toUpperCase() } },
    left:   { style: 'thin', color: { argb: 'FF' + color.toUpperCase() } },
    bottom: { style: 'thin', color: { argb: 'FF' + color.toUpperCase() } },
    right:  { style: 'thin', color: { argb: 'FF' + color.toUpperCase() } },
  })

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RupiyaMe CRM'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(`${months[selectedMonth - 1]} ${selectedYear}`, {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 2 }],
  })

  // ── Column widths ──
  sheet.getColumn(1).width = 12   // Emp ID
  sheet.getColumn(2).width = 22   // Name
  sheet.getColumn(3).width = 18   // Department
  for (let d = 1; d <= daysInMonth; d++) sheet.getColumn(3 + d).width = 6  // wider day col
  sheet.getColumn(3 + daysInMonth + 1).width = 9
  sheet.getColumn(3 + daysInMonth + 2).width = 7
  sheet.getColumn(3 + daysInMonth + 3).width = 9
  sheet.getColumn(3 + daysInMonth + 4).width = 9
  sheet.getColumn(3 + daysInMonth + 5).width = 11
  sheet.getColumn(3 + daysInMonth + 6).width = 12

  // ── Row 1: Title ──
  const lastCol = 3 + daysInMonth + 6
  sheet.mergeCells(1, 1, 1, lastCol)
  const titleCell = sheet.getRow(1).getCell(1)
  titleCell.value = `Attendance Report — ${months[selectedMonth - 1]} ${selectedYear}`
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF0EA5E9' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  titleCell.fill = fill('0A0A0D')
  sheet.getRow(1).height = 24

  // ── Row 2: Headers ──
  const headerRow = sheet.getRow(2)
  headerRow.height = 32

  const applyHeader = (cell, value, bgHex = '0A0A0D') => {
    cell.value = value
    cell.font = { bold: true, color: { argb: 'FF0EA5E9' }, size: 9 }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.fill = fill(bgHex)
    cell.border = {
      ...border('2A2A30'),
      bottom: { style: 'medium', color: { argb: 'FF0EA5E9' } },
    }
  }

  applyHeader(headerRow.getCell(1), 'EMP ID')
  applyHeader(headerRow.getCell(2), 'NAME')
  applyHeader(headerRow.getCell(3), 'DEPARTMENT')

  for (let d = 1; d <= daysInMonth; d++) {
    const dayName = getDayName(selectedYear, selectedMonth, d)
    const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const isHoliday = holidays.some(h => h.date === dateKey)
    const isSun = dayName === 'Sun'
    const bgHex = isHoliday ? '061A1C' : isSun ? '2E1065' : '0A0A0D'
    const fontArgb = isHoliday ? 'FF06B6D4' : isSun ? 'FFa78bfa' : 'FF0EA5E9'
    const hdrCell = headerRow.getCell(3 + d)
    hdrCell.value = `${d}\n${dayName.substring(0,3)}`
    hdrCell.font = { bold: true, size: 8, color: { argb: fontArgb } }
    hdrCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    hdrCell.fill = fill(bgHex)
    hdrCell.border = {
      ...border(isHoliday ? '06B6D4' : isSun ? '5B21B6' : '2A2A30'),
      bottom: { style: 'medium', color: { argb: 'FF0EA5E9' } },
    }
  }

  const summaryHeaders = ['Present', 'Late', 'Half\nDay', 'Holidays', 'Abscond', 'Att %']
  summaryHeaders.forEach((h, i) => applyHeader(headerRow.getCell(3 + daysInMonth + 1 + i), h))

  // ── IST today key ──
  const getISTTodayKey = () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  }
  const todayKey = getISTTodayKey()

  // ── Data rows ──
  attendanceData.forEach((record, rowIdx) => {
    const stats = calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays)
    const joiningDateKey = normalizeDateKey(record.joining_date || record.date_of_joining)
    const inactiveDateKeyExport = record.isActive === false ? normalizeDateKey(record.inactive_from_date) : null
    const row = sheet.getRow(3 + rowIdx)
    row.height = 18

    const applyBase = (cell, value, fontHex = 'FFFFFF', leftAlign = false) => {
      cell.value = value
      cell.font = { color: { argb: 'FF' + fontHex.toUpperCase() }, size: 9, bold: false }
      cell.alignment = { horizontal: leftAlign ? 'left' : 'center', vertical: 'middle' }
      cell.fill = fill('0A0A0D')
      cell.border = border('1F1F22')
    }

    const idCell = row.getCell(1)
    applyBase(idCell, record.employeeId, '0EA5E9')
    idCell.font = { ...idCell.font, bold: true }

    const nameCell = row.getCell(2)
    applyBase(nameCell, record.name, 'FFFFFF', true)
    nameCell.font = { ...nameCell.font, bold: true }

    const deptCell = row.getCell(3)
    applyBase(deptCell, record.department, 'A1A1AA', true)

    // ── Day cells ──
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const isSun = getDayName(selectedYear, selectedMonth, d) === 'Sun'
      const isHoliday = holidays.some(h => h.date === dateKey)
      const isBeforeJoining = joiningDateKey && dateKey < joiningDateKey
      const isAfterInactiveExport = inactiveDateKeyExport && dateKey > inactiveDateKeyExport
      const isBlackedOutExport = isBeforeJoining || isAfterInactiveExport

      let rawStatus = isBlackedOutExport ? null : record[`day${d}`]
      // If no status and it's a past working day → treat as Absent (same as UI)
      if (!rawStatus && !isSun && !isHoliday && !isBlackedOutExport && dateKey <= todayKey) rawStatus = 'A'

      const cell = row.getCell(3 + d)

      if (rawStatus) {
        const s = getStyle(rawStatus)
        cell.value = s.val           // numeric (1, 0.5, 0, -1) or string (IN, —)
        cell.font = { bold: true, size: 9, color: { argb: 'FF' + s.font.toUpperCase() } }
        cell.fill = fill(s.fillHex)
      } else {
        // Empty future/pre-joining/post-inactive day — use special bg if holiday/weekend
        const bgHex = isBlackedOutExport ? '0A0A0D' : (isHoliday ? '061A1C' : isSun ? '2E1065' : '0A0A0D')
        cell.value = ''
        cell.font = { size: 9, color: { argb: 'FF52525B' } }
        cell.fill = fill(bgHex)
      }

      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = border(isHoliday ? '06B6D4' : isSun ? '5B21B6' : '1F1F22')
    }

    // ── Summary columns ──
    const summaryVals = [
      { val: stats.present,            hex: '10B981' },
      { val: stats.late,               hex: 'E5E5E5' },
      { val: stats.halfDay,            hex: 'FFDD00' },
      { val: stats.holidays,           hex: '06B6D4' },
      { val: stats.absconding,         hex: 'FF2A2A' },
      { val: `${stats.attendancePercentage}%`, hex: stats.attendancePercentage >= 75 ? '10B981' : 'FF2A2A' },
    ]
    summaryVals.forEach(({ val, hex }, i) => {
      const cell = row.getCell(3 + daysInMonth + 1 + i)
      cell.value = val
      cell.font = { bold: true, size: 9, color: { argb: 'FF' + hex } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.fill = fill('0A0A0D')
      cell.border = border('1F1F22')
    })
  })

  // ── Legend sheet ──
  const legend = workbook.addWorksheet('Legend')
  legend.getColumn(1).width = 10
  legend.getColumn(2).width = 22
  legend.getColumn(3).width = 38
  const legendData = [
    { val: 1,    fillHex: '10B981', font: '000000', desc: 'Present / Late (full day)' },
    { val: 0.5,  fillHex: 'FFDD00', font: '000000', desc: 'Half Day' },
    { val: 0,    fillHex: 'FF7B00', font: '000000', desc: 'Leave (LV)' },
    { val: 0,    fillHex: 'F5F5F5', font: '000000', desc: 'Absent (white)' },
    { val: -1,   fillHex: 'FF2A2A', font: 'FFFFFF', desc: 'Absconding' },
    { val: 1,    fillHex: '06B6D4', font: '000000', desc: 'Holiday / Sunday Paid' },
    { val: 0,    fillHex: '18181B', font: 'FFFFFF', desc: 'Sunday Zero (not paid)' },
    { val: '—',  fillHex: '2E1065', font: 'A78BFA', desc: 'Weekend (Sunday)' },
    { val: 'IN', fillHex: '3B82F6', font: 'FFFFFF', desc: 'Currently Checked In' },
  ]
  // Header row
  const lhRow = legend.getRow(1)
  ;['Value', 'Color', 'Meaning'].forEach((h, ci) => {
    const c = lhRow.getCell(ci + 1)
    c.value = h
    c.font = { bold: true, color: { argb: 'FF0EA5E9' }, size: 10 }
    c.fill = fill('0A0A0D')
    c.alignment = { horizontal: 'left', vertical: 'middle' }
  })
  lhRow.height = 20
  legendData.forEach((ld, ri) => {
    const lrow = legend.getRow(ri + 2)
    lrow.height = 18
    const c1 = lrow.getCell(1)
    c1.value = ld.val
    c1.font = { bold: true, size: 10, color: { argb: 'FF' + ld.font } }
    c1.alignment = { horizontal: 'center', vertical: 'middle' }
    c1.fill = fill(ld.fillHex)
    c1.border = border('CCCCCC')
    const c2 = lrow.getCell(2)
    c2.value = `#${ld.fillHex}`
    c2.font = { size: 9, color: { argb: 'FF' + ld.fillHex } }
    c2.alignment = { horizontal: 'left', vertical: 'middle' }
    const c3 = lrow.getCell(3)
    c3.value = ld.desc
    c3.font = { size: 9 }
    c3.alignment = { horizontal: 'left', vertical: 'middle' }
  })

  // ── Download ──
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Attendance_${months[selectedMonth - 1]}_${selectedYear}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Holiday Management Modal Component
const HolidayManagementModal = ({ isOpen, onClose, holidays, onUpdateHolidays, selectedYear, selectedMonth }) => {
  const [rangeMode, setRangeMode] = useState(false)
  const [newHolidayDate, setNewHolidayDate] = useState("")
  const [newHolidayStartDate, setNewHolidayStartDate] = useState("")
  const [newHolidayEndDate, setNewHolidayEndDate] = useState("")
  const [newHolidayName, setNewHolidayName] = useState("")
  const [newHolidayDescription, setNewHolidayDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [localHolidays, setLocalHolidays] = useState([])
  const [error, setError] = useState("")
  const [addedCount, setAddedCount] = useState(0)

  // Get user data
  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      setUser(JSON.parse(userData))
    }
  }, [])

  // Load holidays when modal opens
  useEffect(() => {
    if (isOpen && user?.user_id) {
      loadHolidays()
    }
  }, [isOpen, user, selectedYear, selectedMonth])

  const loadHolidays = async () => {
    if (!user?.user_id) return
    
    setLoading(true)
    setError("")
    try {
      const response = await attendanceAPI.getHolidays(selectedYear, selectedMonth, user.user_id)
      if (response.success) {
        setLocalHolidays(response.holidays || [])
      } else {
        setError("Failed to load holidays")
      }
    } catch (error) {
      console.error('Error loading holidays:', error)
      setError("Failed to load holidays. Please try again.")
      setLocalHolidays([]) // Fallback to empty array
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const currentMonthHolidays = localHolidays.filter((holiday) => {
    const holidayDate = new Date(holiday.date)
    return holidayDate.getFullYear() === selectedYear && holidayDate.getMonth() + 1 === selectedMonth
  })

  const handleAddHoliday = async () => {
    if (!newHolidayName || !user?.user_id) {
      setError("Please fill in all required fields")
      return
    }
    if (rangeMode) {
      if (!newHolidayStartDate || !newHolidayEndDate) {
        setError("Please select both start and end dates")
        return
      }
      const start = new Date(newHolidayStartDate)
      const end = new Date(newHolidayEndDate)
      if (end < start) {
        setError("End date must be on or after start date")
        return
      }
      const maxRange = 31
      const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1
      if (diffDays > maxRange) {
        setError(`Range cannot exceed ${maxRange} days`)
        return
      }
    } else {
      if (!newHolidayDate) {
        setError("Please select a date")
        return
      }
    }

    setLoading(true)
    setError("")
    setAddedCount(0)
    try {
      if (rangeMode) {
        // Generate all dates in range and add each one
        const start = new Date(newHolidayStartDate)
        const end = new Date(newHolidayEndDate)
        const dates = []
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(d.toISOString().slice(0, 10))
        }
        let added = 0
        for (const dateStr of dates) {
          try {
            const dayName = new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })
            const nameSuffix = dates.length > 1 ? ` (${dayName})` : ''
            await attendanceAPI.addHoliday(
              newHolidayName + nameSuffix,
              dateStr,
              newHolidayDescription,
              user.user_id
            )
            added++
          } catch (e) {
            // skip duplicates silently
          }
        }
        setAddedCount(added)
      } else {
        const response = await attendanceAPI.addHoliday(
          newHolidayName,
          newHolidayDate,
          newHolidayDescription,
          user.user_id
        )
        if (!response.success) {
          setError(response.message || "Failed to add holiday")
          return
        }
      }
      // Reload and clear form
      await loadHolidays()
      setNewHolidayDate("")
      setNewHolidayStartDate("")
      setNewHolidayEndDate("")
      setNewHolidayName("")
      setNewHolidayDescription("")
      onUpdateHolidays(localHolidays)
    } catch (error) {
      console.error('Error adding holiday:', error)
      setError(error.response?.data?.detail || "Failed to add holiday. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveHoliday = async (holidayId) => {
    if (!user?.user_id) return

    setLoading(true)
    setError("")
    try {
      const response = await attendanceAPI.deleteHoliday(holidayId, user.user_id, true)
      
      if (response.success) {
        // Reload holidays to get updated list
        await loadHolidays()
        // Update parent component + trigger full calendar refresh so table cells update
        const updatedList = localHolidays.filter(h => h._id !== holidayId)
        onUpdateHolidays(updatedList)
        if (response.reset_count > 0) {
          setError('')
          // Brief success flash via error state (styled green inline)
        }
      } else {
        setError(response.message || "Failed to delete holiday")
      }
    } catch (error) {
      console.error('Error deleting holiday:', error)
      setError(error.response?.data?.detail || "Failed to delete holiday. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      // Parse as local date to avoid timezone shift on plain YYYY-MM-DD strings
      const parts = String(dateString).split('T')[0].split('-')
      if (parts.length === 3) {
        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
        const d = parseInt(parts[2], 10)
        const m = parseInt(parts[1], 10) - 1
        const y = parseInt(parts[0], 10)
        return `${String(d).padStart(2,'0')} ${monthNames[m]} ${y}`
      }
      return dateString
    } catch {
      return dateString
    }
  }

  return createPortal(
    <div style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.85)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:ATTENDANCE_MODAL_Z_INDEX,padding:'16px'}}>
      <div style={{backgroundColor:'#09090b',border:'1px solid #27272a',borderRadius:'10px',maxWidth:'640px',width:'100%',maxHeight:'80vh',overflowY:'auto',boxShadow:'0 25px 50px rgba(0,0,0,0.8)'}}>
        {/* Header */}
        <div style={{padding:'16px 20px',borderBottom:'1px solid #27272a',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <h2 style={{color:'#ffffff',fontSize:'16px',fontWeight:700,margin:0}}>Holiday Management</h2>
            <p style={{color:'#a1a1aa',fontSize:'12px',margin:'4px 0 0'}}>Manage company holidays for {months[selectedMonth - 1]} {selectedYear}</p>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#a1a1aa',cursor:'pointer',padding:'4px',display:'flex',alignItems:'center'}}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div style={{padding:'20px'}}>
          {/* Error Message */}
          {error && (
            <div style={{marginBottom:'16px',padding:'12px',backgroundColor:'rgba(255,42,42,0.1)',border:'1px solid rgba(255,42,42,0.3)',borderRadius:'6px'}}>
              <p style={{color:'#ff2a2a',fontSize:'12px',margin:0}}>{error}</p>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div style={{marginBottom:'16px',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}}>
              <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-400"></div>
              <span style={{color:'#a1a1aa',marginLeft:'8px',fontSize:'13px'}}>Processing...</span>
            </div>
          )}

          {/* Add New Holiday */}
          <div style={{marginBottom:'24px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
              <h3 style={{color:'#ffffff',fontSize:'13px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',margin:0}}>Add New Holiday</h3>
              {/* Single / Range toggle */}
              <div style={{display:'flex',background:'#0d0d10',border:'1px solid #27272a',borderRadius:'6px',overflow:'hidden'}}>
                <button
                  onClick={() => { setRangeMode(false); setError(''); setAddedCount(0) }}
                  style={{padding:'5px 12px',fontSize:'11px',fontWeight:600,border:'none',cursor:'pointer',background:!rangeMode?'#06b6d4':'transparent',color:!rangeMode?'#000':'#a1a1aa',transition:'all 0.2s'}}
                >
                  Single Day
                </button>
                <button
                  onClick={() => { setRangeMode(true); setError(''); setAddedCount(0) }}
                  style={{padding:'5px 12px',fontSize:'11px',fontWeight:600,border:'none',cursor:'pointer',background:rangeMode?'#06b6d4':'transparent',color:rangeMode?'#000':'#a1a1aa',transition:'all 0.2s'}}
                >
                  Date Range
                </button>
              </div>
            </div>
            {/* Success count flash */}
            {addedCount > 0 && (
              <div style={{marginBottom:'12px',padding:'10px 14px',backgroundColor:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:'6px'}}>
                <p style={{color:'#10b981',fontSize:'12px',margin:0}}>✅ {addedCount} holiday{addedCount>1?'s':''} added successfully</p>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns: rangeMode ? '1fr 1fr' : '1fr 1fr',gap:'12px',marginBottom:'12px'}}>
              {rangeMode ? (
                <>
                  <div>
                    <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'#a1a1aa',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}}>Start Date *</label>
                    <input
                      type="date"
                      value={newHolidayStartDate}
                      onChange={(e) => setNewHolidayStartDate(e.target.value)}
                      disabled={loading}
                      style={{width:'100%',padding:'8px 12px',background:'#0d0d10',border:'1px solid #27272a',borderRadius:'6px',color:'#ffffff',fontSize:'13px',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
                      onFocus={e => e.target.style.borderColor='#06b6d4'}
                      onBlur={e => e.target.style.borderColor='#27272a'}
                    />
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'#a1a1aa',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}}>End Date *</label>
                    <input
                      type="date"
                      value={newHolidayEndDate}
                      onChange={(e) => setNewHolidayEndDate(e.target.value)}
                      min={newHolidayStartDate || undefined}
                      disabled={loading}
                      style={{width:'100%',padding:'8px 12px',background:'#0d0d10',border:'1px solid #27272a',borderRadius:'6px',color:'#ffffff',fontSize:'13px',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
                      onFocus={e => e.target.style.borderColor='#06b6d4'}
                      onBlur={e => e.target.style.borderColor='#27272a'}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'#a1a1aa',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}}>Holiday Date *</label>
                  <input
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    disabled={loading}
                    style={{width:'100%',padding:'8px 12px',background:'#0d0d10',border:'1px solid #27272a',borderRadius:'6px',color:'#ffffff',fontSize:'13px',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
                    onFocus={e => e.target.style.borderColor='#06b6d4'}
                    onBlur={e => e.target.style.borderColor='#27272a'}
                  />
                </div>
              )}
              <div>
                <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'#a1a1aa',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}}>Holiday Name *</label>
                <input
                  type="text"
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                  placeholder="e.g., Independence Day"
                  disabled={loading}
                  style={{width:'100%',padding:'8px 12px',background:'#0d0d10',border:'1px solid #27272a',borderRadius:'6px',color:'#ffffff',fontSize:'13px',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
                  onFocus={e => e.target.style.borderColor='#06b6d4'}
                  onBlur={e => e.target.style.borderColor='#27272a'}
                />
              </div>
            </div>
            {rangeMode && newHolidayStartDate && newHolidayEndDate && new Date(newHolidayEndDate) >= new Date(newHolidayStartDate) && (
              <div style={{marginBottom:'10px',padding:'7px 12px',background:'rgba(6,182,212,0.08)',border:'1px solid rgba(6,182,212,0.25)',borderRadius:'5px',fontSize:'11px',color:'#06b6d4'}}>
                📅 {Math.round((new Date(newHolidayEndDate) - new Date(newHolidayStartDate)) / (1000*60*60*24)) + 1} day{Math.round((new Date(newHolidayEndDate) - new Date(newHolidayStartDate)) / (1000*60*60*24)) + 1 > 1 ? 's' : ''} will be marked as holiday
              </div>
            )}
            <div style={{marginBottom:'12px'}}>
              <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'#a1a1aa',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}}>Description (Optional)</label>
              <input
                type="text"
                value={newHolidayDescription}
                onChange={(e) => setNewHolidayDescription(e.target.value)}
                placeholder="Additional details about the holiday"
                disabled={loading}
                style={{width:'100%',padding:'8px 12px',background:'#0d0d10',border:'1px solid #27272a',borderRadius:'6px',color:'#ffffff',fontSize:'13px',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
                onFocus={e => e.target.style.borderColor='#06b6d4'}
                onBlur={e => e.target.style.borderColor='#27272a'}
              />
            </div>
            <button
              onClick={handleAddHoliday}
              disabled={loading || !newHolidayName || (rangeMode ? (!newHolidayStartDate || !newHolidayEndDate) : !newHolidayDate)}
              style={{backgroundColor:'#06b6d4',color:'#000',border:'none',borderRadius:'6px',padding:'8px 16px',fontSize:'13px',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',opacity:(loading || !newHolidayName || (rangeMode ? (!newHolidayStartDate || !newHolidayEndDate) : !newHolidayDate)) ? 0.4 : 1,transition:'opacity 0.2s'}}
            >
              <Plus className="h-4 w-4" />
              {loading ? 'Adding...' : (rangeMode ? 'Add Range' : 'Add Holiday')}
            </button>
          </div>

          {/* Current Month Holidays */}
          <div style={{marginBottom:'24px'}}>
            <h3 style={{color:'#ffffff',fontSize:'13px',fontWeight:700,marginBottom:'12px',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 14px'}}>
              {months[selectedMonth - 1]} {selectedYear} Holidays
            </h3>
            {currentMonthHolidays.length === 0 ? (
              <div style={{textAlign:'center',padding:'24px',background:'#0d0d10',border:'1px solid #27272a',borderRadius:'6px'}}>
                <p style={{color:'#52525b',fontSize:'13px',margin:0}}>No holidays set for this month</p>
              </div>
            ) : (
              <div>
                {currentMonthHolidays.map((holiday) => (
                  <div key={holiday._id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'#0d0d10',border:'1px solid #27272a',borderRadius:'6px',marginBottom:'8px'}}>
                    <div>
                      <div style={{color:'#ffffff',fontWeight:600,fontSize:'13px'}}>{holiday.name}</div>
                      <div style={{color:'#a1a1aa',fontSize:'11px',marginTop:'2px'}}>{formatDate(holiday.date)}</div>
                      {holiday.description && (
                        <div style={{color:'#71717a',fontSize:'11px',marginTop:'2px'}}>{holiday.description}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveHoliday(holiday._id)}
                      disabled={loading}
                      style={{background:'transparent',border:'1px solid #3f3f46',borderRadius:'4px',padding:'5px 8px',cursor:'pointer',color:'#ff2a2a',display:'flex',alignItems:'center',opacity:loading?0.4:1,transition:'opacity 0.2s'}}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Holidays */}
          <div>
            <h3 style={{color:'#ffffff',fontSize:'13px',fontWeight:700,marginBottom:'12px',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 14px'}}>All Company Holidays</h3>
            {localHolidays.length === 0 ? (
              <div style={{textAlign:'center',padding:'24px',background:'#0d0d10',border:'1px solid #27272a',borderRadius:'6px'}}>
                <p style={{color:'#52525b',fontSize:'13px',margin:0}}>No holidays configured</p>
              </div>
            ) : (
              <div style={{maxHeight:'200px',overflowY:'auto',background:'#0d0d10',border:'1px solid #27272a',borderRadius:'6px',padding:'8px'}}>
                {localHolidays
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .map((holiday) => (
                    <div key={holiday._id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',background:'#111113',border:'1px solid #27272a',borderRadius:'4px',marginBottom:'6px',fontSize:'12px'}}>
                      <div>
                        <span style={{color:'#ffffff',fontWeight:600}}>{holiday.name}</span>
                        <span style={{color:'#a1a1aa',marginLeft:'10px'}}>{formatDate(holiday.date)}</span>
                        {holiday.description && (
                          <div style={{color:'#71717a',fontSize:'11px',marginTop:'2px'}}>{holiday.description}</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveHoliday(holiday._id)}
                        disabled={loading}
                        style={{background:'transparent',border:'1px solid #3f3f46',borderRadius:'4px',padding:'4px 6px',cursor:'pointer',color:'#ff2a2a',display:'flex',alignItems:'center',opacity:loading?0.4:1}}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Close Button */}
          <div style={{marginTop:'20px',display:'flex',justifyContent:'flex-end'}}>
            <button onClick={onClose} style={{background:'#1f1f22',border:'1px solid #27272a',color:'#ffffff',borderRadius:'6px',padding:'8px 20px',fontSize:'13px',fontWeight:600,cursor:'pointer',transition:'background 0.2s'}}
              onMouseEnter={e => e.target.style.background='#27272a'}
              onMouseLeave={e => e.target.style.background='#1f1f22'}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Edit History Modal Component
const numericStatusLabel = (val) => {
  const n = parseFloat(val)
  if (n === 1)   return { label: 'Full Day',   color: 'bg-green-900/40 border-green-700 text-green-300' }
  if (n === 0.5) return { label: 'Half Day',   color: 'bg-yellow-900/40 border-yellow-700 text-yellow-300' }
  if (n === 0)   return { label: 'Leave',      color: 'bg-blue-900/40 border-blue-700 text-blue-300' }
  if (n === -1)  return { label: 'Absent',     color: 'bg-red-900/40 border-red-700 text-red-300' }
  if (n === -2)  return { label: 'Absconding', color: 'bg-orange-900/40 border-orange-700 text-orange-300' }
  if (val === 'P')  return { label: 'Full Day',   color: 'bg-green-900/40 border-green-700 text-green-300' }
  if (val === 'HD') return { label: 'Half Day',   color: 'bg-yellow-900/40 border-yellow-700 text-yellow-300' }
  if (val === 'LV') return { label: 'Leave',      color: 'bg-blue-900/40 border-blue-700 text-blue-300' }
  if (val === 'A')  return { label: 'Absent',     color: 'bg-red-900/40 border-red-700 text-red-300' }
  if (val === 'AB') return { label: 'Absconding', color: 'bg-orange-900/40 border-orange-700 text-orange-300' }
  return { label: String(val ?? '—'), color: 'bg-gray-700 border-gray-600 text-gray-300' }
}

const parseChangeLine = (line) => {
  // e.g. "status: 1.0 → -1.0"  or  "check_in_time: None → 09:30:00"
  const arrowIdx = line.indexOf('→')
  if (arrowIdx === -1) return { field: line, oldVal: null, newVal: null }
  const colonIdx = line.indexOf(':')
  const field = colonIdx !== -1 ? line.slice(0, colonIdx).trim() : ''
  const oldVal = colonIdx !== -1 ? line.slice(colonIdx + 1, arrowIdx).trim() : ''
  const newVal = line.slice(arrowIdx + 1).trim()
  return { field, oldVal, newVal }
}

const EditHistoryModal = ({ isOpen, onClose, employee, historyData, loading }) => {
  if (!isOpen) return null

  // Show only summary entries (attendance_edited), skip field_updated to avoid duplicates
  // Fall back to field_updated if no summary entries exist (older records)
  const summaryEntries = (historyData || []).filter(e => e.action_type === 'attendance_edited' || e.action_type === 'attendance_created')
  const displayEntries = summaryEntries.length > 0 ? summaryEntries : (historyData || []).filter(e => e.action_type === 'field_updated' && e.new_value !== undefined)
  const sortedDisplayEntries = [...displayEntries].sort((a, b) => {
    const dateA = a.date ? new Date(`${a.date}T00:00:00`).getTime() : 0
    const dateB = b.date ? new Date(`${b.date}T00:00:00`).getTime() : 0
    if (dateA !== dateB) return dateA - dateB
    const timeA = new Date(a.created_at || a.changed_at || a.timestamp || 0).getTime()
    const timeB = new Date(b.created_at || b.changed_at || b.timestamp || 0).getTime()
    return timeA - timeB
  })

  // Helper: Generate a short, clear explanation for auto-status
  const getAutoReasonExplanation = (commentText) => {
    if (!commentText) return null
    const c = commentText.toLowerCase()
    if (c.includes('did not check in') || (c.includes('auto-absent') && c.includes('reporting deadline'))) {
      return 'No check-in before reporting deadline → Absent.'
    }
    if (c.includes('missed check-out') || c.includes('no checkout') || c.includes('auto_absent_no_checkout')) {
      return 'Check-in recorded, no check-out → Absent.'
    }
    if (c.includes('no check-in') || c.includes('auto_absent_no_checkin')) {
      return 'No check-in recorded → Absent.'
    }
    if (c.includes('absconding') || c.includes('absent for 2')) {
      return '2+ consecutive absent days → Absconding.'
    }
    if (c.includes('late check-in') || c.includes('after reporting') || c.includes('half day')) {
      return 'Late check-in after reporting deadline → Half Day.'
    }
    if (c.includes('early check-out') || c.includes('before shift end')) {
      return 'Early check-out before shift end → Half Day.'
    }
    if (c.includes('insufficient') || c.includes('working hours')) {
      return 'Insufficient working hours.'
    }
    if (c.startsWith('check-in') || c.startsWith('check-out') || c.startsWith('normal check')) {
      return null
    }
    return commentText
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: ATTENDANCE_MODAL_Z_INDEX }} onClick={onClose}>
      <div className="bg-[#111117] border border-white/10 rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-5 rounded-t-xl relative sticky top-0 z-10">
          <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <History className="h-5 w-5" />
            Attendance Edit History
          </h2>
          {employee && (
            <p className="text-amber-100 text-sm mt-0.5">
              {getDisplayEmployeeName(employee)} — {sortedDisplayEntries.length} edit{sortedDisplayEntries.length !== 1 ? 's' : ''} this month
            </p>
          )}
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
            </div>
          ) : sortedDisplayEntries.length > 0 ? (
            sortedDisplayEntries.map((entry, index) => {
              const attendanceDate = entry.date ? new Date(entry.date + 'T00:00:00') : null
              const editedAt = new Date(entry.created_at || entry.changed_at || entry.timestamp)
              const editorName = getDisplayEditorName(entry)
              const editorDesignation = entry.details?.editor_designation || ''
              const reason = entry.reason || entry.details?.reason || entry.details?.remarks || entry.details?.comment || ''
              const isSummary = entry.action_type === 'attendance_edited'
              const isCreated = entry.action_type === 'attendance_created'

              // Parse changes from details.changes array (for summary entries)
              const parsedChanges = []
              let oldCommentText = null
              if (isSummary && Array.isArray(entry.details?.changes)) {
                entry.details.changes.forEach(line => {
                  const { field, oldVal, newVal } = parseChangeLine(line)
                  parsedChanges.push({ field, oldVal, newVal })
                  if (field === 'comments') {
                    oldCommentText = oldVal
                  }
                })
              }
              // For field_updated entries use old_value/new_value directly
              if (entry.action_type === 'field_updated') {
                const field = entry.action_description?.split(' ')[0] || 'Field'
                parsedChanges.push({ field, oldVal: String(entry.old_value ?? '—'), newVal: String(entry.new_value ?? '—') })
              }
              // For created: just show new_value as the status set
              if (isCreated && entry.new_value !== undefined) {
                parsedChanges.push({ field: 'status', oldVal: null, newVal: String(entry.new_value) })
              }

              if (!oldCommentText) {
                oldCommentText = entry.details?.old_comments || entry.details?.previous_comments || null
              }

              // Get auto-reason explanation from old comment
              const autoReasonText = getAutoReasonExplanation(oldCommentText)
              const nonStatusChanges = parsedChanges.filter(ch => ch.field !== 'status')

              return (
                <div key={index} className="bg-[#1a1a22] border border-white/10 rounded-xl overflow-hidden hover:border-amber-500/30 transition-colors">
                  {/* Card Header: Date + Editor */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
                    <div className="flex items-center gap-2 flex-wrap">
                      {attendanceDate && (
                        <span className="bg-amber-900/30 border border-amber-700/60 text-amber-300 text-xs font-bold px-3 py-1 rounded-full">
                          📅 {attendanceDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                        </span>
                      )}
                      {isCreated && (
                        <span className="bg-blue-900/30 border border-blue-700/60 text-blue-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">New Record</span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center gap-1.5 text-xs">
                        <User className="h-3 w-3 text-indigo-400 shrink-0" />
                        <span className="text-white font-semibold">{editorName}</span>
                        {editorDesignation && <span className="text-zinc-400">· {editorDesignation}</span>}
                      </div>
                      <span className="text-zinc-400 text-[10px]">
                        {editedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    {/* Status change — show only status row with prominent badges */}
                    {parsedChanges.filter(ch => ch.field === 'status').map((ch, ci) => {
                      const oldInfo = numericStatusLabel(ch.oldVal)
                      const newInfo = numericStatusLabel(ch.newVal)
                      return (
                        <div key={ci} className="flex items-center gap-3">
                          <span className="text-zinc-300 text-xs font-semibold w-14 shrink-0">Status</span>
                          {ch.oldVal !== null && ch.oldVal !== 'None' && ch.oldVal !== '' && (
                            <>
                              <span className={`text-xs font-bold px-2.5 py-1 rounded border ${oldInfo.color}`}>{oldInfo.label}</span>
                              <span className="text-zinc-300 text-sm">→</span>
                            </>
                          )}
                          <span className={`text-xs font-bold px-2.5 py-1 rounded border ${newInfo.color}`}>{newInfo.label}</span>
                        </div>
                      )
                    })}

                    {nonStatusChanges.length > 0 && (
                      <div className="space-y-2">
                        {/* Separate 'comments' field and render as remark block */}
                        {nonStatusChanges.filter(ch => String(ch.field || '').toLowerCase() === 'comments').map((ch, idx) => {
                          const val = ch.newVal && ch.newVal !== 'None' && ch.newVal !== 'empty' ? ch.newVal : null
                          if (!val) return null
                          return (
                            <div key={`cmt-${idx}`} className="bg-sky-900/15 border border-sky-500/20 rounded-lg px-3 py-2">
                              <span className="text-sky-300 text-[10px] font-bold uppercase tracking-wide block mb-0.5">System Remark</span>
                              <span className="text-sky-100 text-xs leading-relaxed">{val}</span>
                            </div>
                          )
                        })}
                        {/* Other non-status, non-comments changes */}
                        {nonStatusChanges.filter(ch => String(ch.field || '').toLowerCase() !== 'comments').length > 0 && (
                          <div className="bg-indigo-900/15 border border-indigo-500/20 rounded-lg px-3 py-2 space-y-1">
                            <span className="text-indigo-300 text-[10px] font-bold uppercase tracking-wide block mb-0.5">Change details</span>
                            {nonStatusChanges.filter(ch => String(ch.field || '').toLowerCase() !== 'comments').map((ch, idx) => (
                              <p key={`${ch.field}-${idx}`} className="text-indigo-100 text-xs leading-relaxed">
                                • {toSimpleChangeRemark(ch)}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Previous status reason (auto-absent / absconding explanation) */}
                    {autoReasonText && (
                      <div className="bg-rose-900/15 border border-rose-500/20 rounded-lg px-3 py-2">
                        <span className="text-rose-300 text-[10px] font-bold uppercase tracking-wide block mb-0.5">Reason for previous status</span>
                        <span className="text-rose-100 text-xs leading-relaxed">{autoReasonText}</span>
                      </div>
                    )}

                    {/* Reason for change (given by editor) */}
                    {reason && (
                      <div className="bg-emerald-900/15 border border-emerald-500/20 rounded-lg px-3 py-2">
                        <span className="text-emerald-300 text-[10px] font-bold uppercase tracking-wide block mb-0.5">Reason for change</span>
                        <span className="text-white text-sm leading-relaxed">{reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-center py-12">
              <History className="h-14 w-14 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-300 text-base">No edit history found for this month</p>
              <p className="text-zinc-500 text-sm mt-2">No attendance edits have been recorded yet</p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button onClick={onClose} className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors border border-white/10">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Deduction Detail Modal Component
const DeductionDetailModal = ({ isOpen, onClose, data, onRevoke }) => {
  const [revoking, setRevoking] = useState(null)
  if (!isOpen || !data) return null

  const {
    employee, stats, monthlySalary, perDaySalary, daysInMonth,
    warningPenalties, selectedYear, selectedMonth,
    attendanceDeduction, warningFine,
    financeDeductions, shortfall, shortfallDeduction,
    effectiveSalary,
  } = data

  const totalWarningFine = (warningPenalties || []).reduce((s, p) => s + (p.penalty_amount || 0), 0)
  const financeDedTotal  = (financeDeductions || []).reduce((s, d) => s + (Number(d.amount) || 0), 0)
  const totalDeduction   = Math.round((attendanceDeduction || 0) + totalWarningFine + financeDedTotal + (shortfallDeduction || 0))
  // Use effectiveSalary (pro-rated for mid-month joiners) as base for netSalary
  const baseSalary = effectiveSalary != null ? effectiveSalary : monthlySalary
  const netSalary  = Math.max(0, baseSalary - totalDeduction)
  const monthName  = months[selectedMonth - 1]

  const handleRevoke = async (warningId) => {
    setRevoking(warningId)
    await onRevoke(warningId, employee.mongoId)
    setRevoking(null)
  }

  const SectionCard = ({ icon, title, color, borderColor, children }) => (
    <div style={{ borderRadius: '8px', padding: '16px', background: '#1a1a24', border: `1px solid ${borderColor}` }}>
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color }}>{icon} {title}</div>
      {children}
    </div>
  )

  const Row = ({ label, value, valueColor, bold, borderTop }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', ...(borderTop ? { paddingTop: '8px', borderTop: '1px solid #2a2a3a', marginTop: '4px' } : {}) }}>
      <span style={{ color: '#9ca3af' }}>{label}</span>
      <span style={{ color: valueColor || '#e5e7eb', fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  )

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: ATTENDANCE_MODAL_Z_INDEX }}>
      <div style={{ background: '#0f0f17', border: '1px solid #2a2a3a', borderRadius: '12px', width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.8)' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #7f1d1d, #991b1b)', padding: '18px 20px', borderRadius: '12px 12px 0 0', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '14px', right: '14px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', cursor: 'pointer', padding: '4px', color: '#fff', display: 'flex', alignItems: 'center' }}>
            <X className="h-5 w-5" />
          </button>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>&#x1F4B0; Deduction Breakdown</div>
          <div style={{ fontSize: '13px', color: '#fca5a5', marginTop: '4px' }}>{employee.name} &nbsp;&middot;&nbsp; {monthName} {selectedYear}</div>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Salary summary bar */}
          <div style={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Fixed Salary</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#e5e7eb' }}>&#x20B9;{monthlySalary.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ fontSize: '20px', color: '#4b5563' }}>&#x2212;</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Total Deductions</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#ef4444' }}>&#x20B9;{totalDeduction.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ fontSize: '20px', color: '#4b5563' }}>=</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Net Payable</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981' }}>&#x20B9;{netSalary.toLocaleString('en-IN')}</div>
            </div>
          </div>

          {totalDeduction === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>&#x2705;</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#9ca3af' }}>No Deductions</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Full salary payable for {monthName} {selectedYear}</div>
            </div>
          ) : (
            <>
              {/* 1. Attendance Deduction */}
              {(attendanceDeduction || 0) > 0 && (
                <SectionCard icon="&#x1F4C5;" title="Attendance Deduction" color="#fb923c" borderColor="#431407">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <Row label="Fixed Monthly Salary" value={`₹${monthlySalary.toLocaleString('en-IN')}`} />
                    <Row label="Days in Month" value={daysInMonth} />
                    <Row label="Per Day Rate" value={`₹${(perDaySalary || monthlySalary / daysInMonth).toFixed(2)}`} />
                    <Row label="Days Present (earned)" value={stats.presentScore ?? stats.finalScore} valueColor="#34d399" />
                    {(stats.plDays || 0) > 0 && (
                      <Row label={`PL Benefit (+${stats.plDays} day${stats.plDays !== 1 ? 's' : ''})`} value={`+${stats.plDays} day${stats.plDays !== 1 ? 's' : ''}`} valueColor="#a78bfa" />
                    )}
                    <Row label="Salary Earned" value={`₹${Math.round((perDaySalary || monthlySalary / daysInMonth) * Math.min(stats.finalScore, stats.effectiveDays || daysInMonth)).toLocaleString('en-IN')}`} valueColor="#34d399" />
                    <Row label="Absent / Absconding days" value={`${(stats.absentDays || 0) + (stats.absconding || 0)} day(s)`} valueColor="#f87171" />
                    <Row label="Attendance Deduction" value={`− ₹${Math.round(attendanceDeduction).toLocaleString('en-IN')}`} valueColor="#fb923c" bold borderTop />
                  </div>
                </SectionCard>
              )}

              {/* 2. Shortfall → Carry Forward (info only, not a deduction) */}
              {(shortfall || 0) > 0 && (
                <SectionCard icon="&#x1F3AF;" title="Target Shortfall \u2192 Carry Forward" color="#c084fc" borderColor="#4c1d95">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <Row label="Monthly Target" value={`₹${(employee.monthlyTarget || 0).toLocaleString('en-IN')}`} />
                    <Row label="Final Business Done" value={`₹${(employee.settledTarget || 0).toLocaleString('en-IN')}`} valueColor={(employee.settledTarget || 0) >= (employee.monthlyTarget || 1) ? '#34d399' : '#f87171'} />
                    <Row label="Shortfall" value={`₹${(shortfall || 0).toLocaleString('en-IN')}`} valueColor="#f87171" />
                    <div style={{ padding: '8px 10px', background: 'rgba(192,132,252,0.08)', borderRadius: '6px', marginTop: '4px', border: '1px solid #4c1d95' }}>
                      <div style={{ fontSize: '12px', color: '#c084fc', fontWeight: 600 }}>&#x2139;&#xFE0F; Shortfall carries forward to next month</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '3px' }}>Next month's total target = Monthly Target + ₹{(shortfall || 0).toLocaleString('en-IN')} carry forward</div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>No salary deduction this month — applied when salary is processed in Salary Management</div>
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* 3. Warning Fines */}
              {warningPenalties && warningPenalties.length > 0 && (
                <SectionCard icon="&#x26A0;&#xFE0F;" title={`Warning Fines (${warningPenalties.length})`} color="#f87171" borderColor="#7f1d1d">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {warningPenalties.map((p, idx) => (
                      <div key={p.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', paddingBottom: idx < warningPenalties.length - 1 ? '10px' : 0, borderBottom: idx < warningPenalties.length - 1 ? '1px solid #2a2a3a' : 'none' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#fca5a5' }}>{p.warning_type}</div>
                          {p.warning_message && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.warning_message}</div>}
                          {p.issued_date && <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '2px' }}>Issued: {new Date(p.issued_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#f87171' }}>− ₹{Number(p.penalty_amount).toLocaleString('en-IN')}</span>
                          <button
                            disabled={revoking === p.id}
                            onClick={() => handleRevoke(p.id)}
                            style={{ fontSize: '11px', background: '#78350f', border: '1px solid #92400e', borderRadius: '4px', cursor: 'pointer', padding: '3px 8px', color: '#fde68a', fontWeight: 600, opacity: revoking === p.id ? 0.5 : 1 }}
                          >
                            {revoking === p.id ? '...' : 'Revoke'}
                          </button>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #2a2a3a', fontSize: '13px', fontWeight: 600 }}>
                      <span style={{ color: '#9ca3af' }}>Total Warning Fines</span>
                      <span style={{ color: '#f87171' }}>− ₹{Math.round(totalWarningFine).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* 4. Finance Deductions */}
              {financeDeductions && financeDeductions.length > 0 && (
                <SectionCard icon="&#x1F3E6;" title={`Finance Deductions (${financeDeductions.length})`} color="#60a5fa" borderColor="#1e3a5f">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {financeDeductions.map((d, idx) => (
                      <div key={d._id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', paddingBottom: idx < financeDeductions.length - 1 ? '10px' : 0, borderBottom: idx < financeDeductions.length - 1 ? '1px solid #2a2a3a' : 'none' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#93c5fd' }}>{d.deduction_type || 'Deduction'}</div>
                          {d.description && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{d.description}</div>}
                          {d.date && <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '2px' }}>Date: {new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>}
                          <div style={{ fontSize: '10px', color: '#059669', marginTop: '2px', textTransform: 'uppercase', fontWeight: 600 }}>{d.status}</div>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#60a5fa', flexShrink: 0 }}>− ₹{Number(d.amount).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #2a2a3a', fontSize: '13px', fontWeight: 600 }}>
                      <span style={{ color: '#9ca3af' }}>Total Finance Deductions</span>
                      <span style={{ color: '#60a5fa' }}>− ₹{Math.round(financeDedTotal).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* Grand Total */}
              <div style={{ background: 'linear-gradient(135deg, #450a0a, #7f1d1d)', border: '1px solid #b91c1c', borderRadius: '8px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ color: '#fca5a5', fontWeight: 700, fontSize: '15px' }}>Total Deductions</span>
                  <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '22px' }}>− ₹{totalDeduction.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ height: '1px', background: '#7f1d1d', marginBottom: '10px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(attendanceDeduction || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span style={{ color: '#6b7280' }}>Attendance</span><span style={{ color: '#fb923c' }}>₹{Math.round(attendanceDeduction).toLocaleString('en-IN')}</span></div>}
                  {(shortfallDeduction || 0) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span style={{ color: '#6b7280' }}>Target Shortfall</span><span style={{ color: '#c084fc' }}>₹{Math.round(shortfallDeduction).toLocaleString('en-IN')}</span></div>}
                  {totalWarningFine > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span style={{ color: '#6b7280' }}>Warning Fines</span><span style={{ color: '#f87171' }}>₹{Math.round(totalWarningFine).toLocaleString('en-IN')}</span></div>}
                  {financeDedTotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span style={{ color: '#6b7280' }}>Finance Deductions</span><span style={{ color: '#60a5fa' }}>₹{Math.round(financeDedTotal).toLocaleString('en-IN')}</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid #7f1d1d' }}>
                    <span style={{ color: '#9ca3af', fontWeight: 600 }}>Net Payable Salary</span>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>₹{netSalary.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button onClick={onClose} style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#d1d5db', padding: '8px 20px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Salary Detail Modal Component
const SalaryDetailModal = ({ isOpen, onClose, salaryData }) => {
  if (!isOpen || !salaryData) return null

  const { employee, stats, calculatedSalary, monthlySalary, perDaySalary, selectedYear, selectedMonth, daysInMonth, warningPenalties } = salaryData

  // Calculate total warning deductions (active, non-waived penalties this month)
  const totalWarningDeduction = (warningPenalties || []).reduce((sum, p) => sum + (p.penalty_amount || 0), 0)
  const finalNetSalary = Math.max(0, calculatedSalary - totalWarningDeduction)

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    const monthName = months[selectedMonth - 1]
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Salary Slip - ${employee.name} - ${monthName} ${selectedYear}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              color: #333;
            }
            .salary-slip-title {
              font-size: 18px;
              color: #666;
              margin-top: 5px;
            }
            .employee-info {
              display: flex;
              justify-content: space-between;
              margin-bottom: 20px;
              background: #f5f5f5;
              padding: 15px;
              border-radius: 5px;
            }
            .info-section {
              flex: 1;
            }
            .info-label {
              font-weight: bold;
              color: #333;
              font-size: 12px;
              text-transform: uppercase;
            }
            .info-value {
              font-size: 14px;
              color: #666;
              margin-top: 3px;
            }
            .details-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            .details-table th {
              background: #03b0f5;
              color: white;
              padding: 10px;
              text-align: left;
              font-size: 14px;
            }
            .details-table td {
              padding: 10px;
              border-bottom: 1px solid #ddd;
              font-size: 14px;
            }
            .details-table tr:nth-child(even) {
              background: #f9f9f9;
            }
            .total-row {
              background: #e8f5e9 !important;
              font-weight: bold;
              font-size: 16px;
            }
            .total-salary {
              text-align: right;
              margin-top: 30px;
              padding: 20px;
              background: #e8f5e9;
              border-radius: 5px;
            }
            .total-label {
              font-size: 18px;
              color: #333;
            }
            .total-amount {
              font-size: 28px;
              color: #10b981;
              font-weight: bold;
              margin-top: 5px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #333;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">RUPIYA ME</div>
            <div class="salary-slip-title">Salary Slip for ${monthName} ${selectedYear}</div>
          </div>
          
          <div class="employee-info">
            <div class="info-section">
              <div class="info-label">Employee Name</div>
              <div class="info-value">${employee.name}</div>
            </div>
            <div class="info-section">
              <div class="info-label">Employee ID</div>
              <div class="info-value">${employee.employeeId}</div>
            </div>
            <div class="info-section">
              <div class="info-label">Department</div>
              <div class="info-value">${employee.department || 'N/A'}</div>
            </div>
            <div class="info-section">
              <div class="info-label">Month/Year</div>
              <div class="info-value">${monthName} ${selectedYear}</div>
            </div>
          </div>

          <table class="details-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: right;">Days/Units</th>
                <th style="text-align: right;">Rate</th>
                <th style="text-align: right;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Monthly Salary (Fixed)</td>
                <td style="text-align: right;">-</td>
                <td style="text-align: right;">-</td>
                <td style="text-align: right;">₹${monthlySalary.toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td>Total Days in Month</td>
                <td style="text-align: right;">${daysInMonth}</td>
                <td style="text-align: right;">-</td>
                <td style="text-align: right;">-</td>
              </tr>
              <tr>
                <td>Per Day Salary</td>
                <td style="text-align: right;">-</td>
                <td style="text-align: right;">₹${perDaySalary.toFixed(2)}</td>
                <td style="text-align: right;">-</td>
              </tr>
              <tr style="background: #fff3cd;">
                <td><strong>Attendance Breakdown</strong></td>
                <td style="text-align: right;">-</td>
                <td style="text-align: right;">-</td>
                <td style="text-align: right;">-</td>
              </tr>
              <tr>
                <td>&nbsp;&nbsp;Present Days (Score)</td>
                <td style="text-align: right;">${stats.presentScore}</td>
                <td style="text-align: right;">₹${perDaySalary.toFixed(2)}</td>
                <td style="text-align: right;">₹${(stats.presentScore * perDaySalary).toFixed(2)}</td>
              </tr>
              <tr>
                <td>&nbsp;&nbsp;Paid Leave (PL)</td>
                <td style="text-align: right;">${stats.plDays}</td>
                <td style="text-align: right;">₹${perDaySalary.toFixed(2)}</td>
                <td style="text-align: right;">₹${(stats.plDays * perDaySalary).toFixed(2)}</td>
              </tr>
              <tr>
                <td>&nbsp;&nbsp;Earned Leave (EL)</td>
                <td style="text-align: right;">${stats.elDays}</td>
                <td style="text-align: right;">₹${perDaySalary.toFixed(2)}</td>
                <td style="text-align: right;">₹${(stats.elDays * perDaySalary).toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Total Working Days (Final Score)</strong></td>
                <td style="text-align: right;"><strong>${stats.finalScore}</strong></td>
                <td style="text-align: right;">-</td>
                <td style="text-align: right;">-</td>
              </tr>
              ${stats.absconding > 0 ? `
              <tr style="background: #ffebee;">
                <td>&nbsp;&nbsp;Absconding Days (Penalty)</td>
                <td style="text-align: right;">${stats.absconding}</td>
                <td style="text-align: right;">- ₹${perDaySalary.toFixed(2)}</td>
                <td style="text-align: right;" style="color: #dc2626;">- ₹${(stats.absconding * perDaySalary).toFixed(2)}</td>
              </tr>
              ` : ''}
              ${(warningPenalties && warningPenalties.length > 0) ? `
              <tr style="background: #ffebee;">
                <td colspan="4" style="padding-top: 8px;"><strong style="color: #c62828;">Warning Penalty Deductions</strong></td>
              </tr>
              ${warningPenalties.map(p => `
              <tr style="background: #fff8f8;">
                <td>&nbsp;&nbsp;Warning: ${p.warning_type}${p.warning_message ? ' — ' + p.warning_message : ''}</td>
                <td style="text-align: right;">1</td>
                <td style="text-align: right; color: #dc2626;">- ₹${p.penalty_amount.toLocaleString('en-IN')}</td>
                <td style="text-align: right; color: #dc2626;">- ₹${p.penalty_amount.toLocaleString('en-IN')}</td>
              </tr>
              `).join('')}
              <tr style="background: #ffebee; font-weight: bold;">
                <td colspan="3">Total Warning Deductions</td>
                <td style="text-align: right; color: #dc2626;">- ₹${totalWarningDeduction.toLocaleString('en-IN')}</td>
              </tr>
              ` : ''}
              <tr class="total-row">
                <td colspan="3"><strong>NET PAYABLE SALARY</strong></td>
                <td style="text-align: right;"><strong>₹${finalNetSalary.toLocaleString('en-IN')}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="total-salary">
            <div class="total-label">Net Payable Amount:</div>
            <div class="total-amount">₹${finalNetSalary.toLocaleString('en-IN')}</div>
          </div>

          <div class="footer">
            <p>This is a computer-generated salary slip. Signature not required.</p>
            <p>Generated on ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
          </div>
        </body>
      </html>
    `
    
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }

  const monthName = months[selectedMonth - 1]

  return createPortal(
    <div className="fixed inset-0 bg-transparent bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: ATTENDANCE_MODAL_Z_INDEX }}>
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 rounded-t-lg relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors">
            <X className="h-6 w-6" />
          </button>
          <h2 className="text-xl font-bold">Salary Details</h2>
          <p className="text-green-100 text-sm mt-1">{employee.name} - {monthName} {selectedYear}</p>
        </div>

        <div className="p-6 bg-gray-900">
          {/* Employee Info Card */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
              <div className="text-xs text-gray-400 uppercase">Employee ID</div>
              <div className="text-blue-300 font-semibold mt-1">{employee.employeeId}</div>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
              <div className="text-xs text-gray-400 uppercase">Department</div>
              <div className="text-gray-200 font-semibold mt-1">{employee.department || 'N/A'}</div>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
              <div className="text-xs text-gray-400 uppercase">Role</div>
              <div className="text-gray-200 font-semibold mt-1">{employee.role || 'N/A'}</div>
            </div>
            <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
              <div className="text-xs text-gray-400 uppercase">Monthly Salary</div>
              <div className="text-green-400 font-semibold mt-1">₹{monthlySalary.toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* Salary Calculation Details */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-5 mb-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Salary Calculation Breakdown</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-gray-700">
                <span className="text-gray-300">Total Days in {monthName}</span>
                <span className="text-gray-200 font-semibold">{daysInMonth} days</span>
              </div>
              
              <div className="flex justify-between items-center pb-2 border-b border-gray-700">
                <span className="text-gray-300">Per Day Salary Rate</span>
                <span className="text-gray-200 font-semibold">₹{perDaySalary.toFixed(2)}</span>
              </div>

              <div className="bg-gray-700/50 rounded p-3 mt-4">
                <div className="text-sm font-semibold text-cyan-300 mb-3">Attendance Summary</div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm">Present Score</span>
                    <span className="text-green-400 font-semibold">{stats.presentScore} days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm">Paid Leave (PL)</span>
                    <span className="text-purple-400 font-semibold">{stats.plDays} days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 text-sm">Earned Leave (EL)</span>
                    <span className="text-blue-400 font-semibold">{stats.elDays} days</span>
                  </div>
                  {stats.absconding > 0 && (
                    <div className="flex justify-between items-center text-red-400">
                      <span className="text-sm">Absconding Days</span>
                      <span className="font-semibold">{stats.absconding} days</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-600">
                    <span className="text-orange-300 font-semibold">Final Score</span>
                    <span className="text-orange-400 font-bold">{stats.finalScore} days</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700/50 rounded p-3 mt-2">
                <div className="flex justify-between items-center pb-2 border-b border-gray-600">
                  <div>
                    <div className="text-sm text-green-300">Attendance Pay</div>
                    <div className="text-xs text-gray-400 mt-1">{stats.finalScore} days × ₹{perDaySalary.toFixed(2)}</div>
                  </div>
                  <span className="text-green-400 font-semibold">₹{calculatedSalary.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Warning Penalty Deductions */}
              {warningPenalties && warningPenalties.length > 0 && (
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mt-3">
                  <div className="text-sm font-semibold text-red-300 mb-2 flex items-center gap-2">
                    <span>⚠️</span> Warning Penalty Deductions
                  </div>
                  <div className="space-y-2">
                    {warningPenalties.map((p, idx) => (
                      <div key={p.id || idx} className="flex justify-between items-start text-sm">
                        <div className="text-gray-300 flex-1 pr-2">
                          <span className="font-medium text-red-300">{p.warning_type}</span>
                          {p.warning_message && <span className="text-gray-500 ml-1 text-xs">— {p.warning_message}</span>}
                          {p.issued_date && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {new Date(p.issued_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })}
                            </div>
                          )}
                        </div>
                        <span className="text-red-400 font-semibold whitespace-nowrap">- ₹{Number(p.penalty_amount).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 border-t border-red-800">
                      <span className="text-red-300 font-semibold text-sm">Total Deductions</span>
                      <span className="text-red-400 font-bold">- ₹{totalWarningDeduction.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-green-900/30 rounded p-4 mt-4 border border-green-700">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-green-300">Net Payable</div>
                    {totalWarningDeduction > 0 && (
                      <div className="text-xs text-gray-400 mt-1">After warning deductions</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-400">
                      ₹{finalNetSalary.toLocaleString('en-IN')}
                    </div>
                    <div className="text-xs text-green-300">Final Amount</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Grace and Additional Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <div className="text-sm text-gray-400">Grace Remaining</div>
              <div className="text-2xl font-bold text-cyan-400 mt-1">{stats.graceRemaining}/{stats.graceTotal}</div>
            </div>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <div className="text-sm text-gray-400">Attendance %</div>
              <div className="text-2xl font-bold text-blue-400 mt-1">{stats.attendancePercentage}%</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={handlePrint}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-2 rounded-md transition-colors flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-2 rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Employee Detail Modal Component
const EmployeeDetailModal = ({ employee, selectedDate, isOpen, onClose, onUpdate, selectedYear, selectedMonth, canUserEdit, attendanceSettings }) => {
  const [selectedAttendance, setSelectedAttendance] = useState("")
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const statusDropdownRef = useRef(null)
  const [showHistory, setShowHistory] = useState(false)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState("")
  const [history, setHistory] = useState([])
  const [attendanceDetail, setAttendanceDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [updateReason, setUpdateReason] = useState("")

  // Get user data
  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      setUser(JSON.parse(userData))
    }
  }, [])

  // Close status dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) {
        setStatusDropdownOpen(false)
      }
    }
    if (statusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [statusDropdownOpen])

  // Reset attendanceDetail + pre-select dropdown whenever modal opens or employee/date changes
  useEffect(() => {
    if (isOpen && employee && selectedDate) {
      const status = employee[`day${selectedDate}`] || 'A'
      setSelectedAttendance(status)
      setUpdateReason('')
      setAttendanceDetail(null)  // Reset stale detail — loadAttendanceDetail will re-populate it
    }
  }, [isOpen, employee, selectedDate])

  // Load attendance detail when modal opens
  useEffect(() => {
    if (isOpen && employee && selectedDate && user?.user_id) {
      loadAttendanceDetail()
    }
  }, [isOpen, employee, selectedDate, user])

  // Check edit permissions using the imported permission functions
  const hasEditPermission = () => {
    if (!employee?.id) {
      console.log('🔒 hasEditPermission: No employee.id, returning false');
      return false;
    }
    
    // Get user permissions from localStorage
    const userPermissions = getUserPermissions();
    console.log('🔒 hasEditPermission DEBUG:', {
      employeeId: employee?.id,
      userPermissions,
      type: typeof userPermissions,
      attendancePerms: userPermissions?.attendance || userPermissions?.Attendance,
      isSuperAdminResult: isSuperAdmin(userPermissions),
      hasUpdatePerm: hasPermission(userPermissions, 'attendance', 'update')
    });
    
    // Superadmin with wildcard (*) can always edit attendance
    if (isSuperAdmin(userPermissions)) {
      console.log('🔒 hasEditPermission: Super admin, returning true');
      return true;
    }
    
    // STRICT CHECK: User must have explicit 'update_attendance' (or 'update') action in attendance permissions
    // Uses hasPermission which handles both object and array permission formats
    const result = hasPermission(userPermissions, 'attendance', 'update_attendance') ||
                   hasPermission(userPermissions, 'attendance', 'update');
    console.log('🔒 hasEditPermission: hasPermission result =', result);
    return result;
  };

  const loadAttendanceDetail = async () => {
    if (!employee || !selectedDate || !user?.user_id) return
    
    setLoading(true)
    try {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`
      
      // Load attendance detail — use mongoId (MongoDB _id) since backend queries by _id
      const detailData = await attendanceAPI.getAttendanceDetail(employee.mongoId || employee.id, dateStr, user.user_id)
      console.log('📊 Attendance detail loaded:', detailData);
      // Response is { success: true, attendance: { id: '...', ... } } — unwrap correctly
      setAttendanceDetail(detailData?.attendance || detailData)
      
      // Load comments
      try {
        const commentsData = await attendanceAPI.getComments(employee.id, dateStr, user.user_id)
        setComments(commentsData.comments || [])
      } catch (error) {
        console.error('Error loading comments:', error)
        setComments([])
      }
      
      // Load history
      try {
        const historyData = await attendanceAPI.getHistory(employee.mongoId || employee.id, dateStr, user.user_id)
        setHistory(historyData.history || [])
      } catch (error) {
        console.error('Error loading history:', error)
        setHistory([])
      }
      
    } catch (error) {
      console.error('Error loading attendance detail:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !employee) return null

  const displayEmployeeName = getDisplayEmployeeName(employee)
  const displayEmployeeCode = employee.employeeId || employee.employee_code || employee.employee_id || `EMP-${employee.id?.slice?.(-6) || '???'}`

  const currentStatus = employee[`day${selectedDate}`] || "A"
  const statusText = getStatusText(currentStatus)

  const formatDate = (year, month, day) => {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const handleUpdate = async () => {
    if (!selectedAttendance || !user?.user_id) return
    
    // Show reason modal before updating
    setShowReasonModal(true)
  }

  const handleConfirmUpdate = async () => {
    if (!updateReason.trim()) {
      return
    }

    if (!selectedAttendance || !user?.user_id) return
    
    console.log('🔄 [UPDATE] Starting attendance update')
    console.log('📝 [UPDATE] Reason:', updateReason.trim())
    console.log('👤 [UPDATE] Employee:', employee.id, displayEmployeeName)
    console.log('📅 [UPDATE] Date:', selectedDate, 'Status:', selectedAttendance)
    
    setLoading(true)
    setShowReasonModal(false)
    
    try {
      // Convert status to backend format
      let statusValue
      switch (selectedAttendance) {
        case "P": statusValue = 1; break
        case "HD": statusValue = 0.5; break
        case "A": statusValue = -1; break     // Absent = -1 in backend
        case "AB": statusValue = -2; break    // Absconding = -2 in backend
        case "LV": statusValue = 0; break     // Leave = 0 in backend
        default: statusValue = -1
      }

      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`
      
      console.log('📊 [UPDATE] Status value:', statusValue, 'Date string:', dateStr)
      
      // If we have an attendance record, edit it
      if (attendanceDetail?.id) {
        console.log('✏️ [UPDATE] Editing existing attendance record:', attendanceDetail.id)
        const editData = {
          status: statusValue,
          comments: newComment || '',
          reason: updateReason.trim()
        }
        console.log('📤 [UPDATE] Edit data:', editData)
        const response = await attendanceAPI.editAttendance(attendanceDetail.id, editData, user.user_id)
        console.log('✅ [UPDATE] Edit response:', response)
      } else {
        console.log('➕ [UPDATE] Creating new attendance record')
        // Create new attendance record
        const attendanceData = {
          employee_id: employee.mongoId || employee.id,
          date: dateStr,
          status: statusValue,
          comments: newComment || '',
          reason: updateReason.trim(),
          check_in_time: null,
          check_out_time: null,
          is_holiday: false
        }
        console.log('📤 [UPDATE] Attendance data:', attendanceData)
        const response = await attendanceAPI.markAttendance(attendanceData, user.user_id)
        console.log('✅ [UPDATE] Mark response:', response)
      }
      
      // Update parent component
      if (onUpdate) {
        onUpdate(employee.id, selectedDate, selectedAttendance)
      }
      
      // Reload detail to get updated data
      await loadAttendanceDetail()
      
      // Clear reason and reset status selector back to current (closes remark textarea)
      setUpdateReason('')
      setSelectedAttendance('')
      
      console.log('🎉 [UPDATE] Attendance update completed successfully')
    } catch (error) {
      console.error('❌ [UPDATE] Error updating attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleShowHistory = () => {
    setShowHistory(!showHistory)
  }

  const handleSendComment = async () => {
    if (!newComment.trim() || !user?.user_id || !employee || !selectedDate) return
    
    setLoading(true)
    try {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`
      
      // Call the new comment API
      await attendanceAPI.addComment(employee.id, dateStr, newComment.trim(), user.user_id)
      
      // Reload comments to get the updated list
      const commentsData = await attendanceAPI.getComments(employee.id, dateStr, user.user_id)
      setComments(commentsData.comments || [])
      setNewComment("")
      
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6" style={{ zIndex: ATTENDANCE_MODAL_Z_INDEX }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl bg-[#050505] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/30 flex-shrink-0">
              {displayEmployeeName?.charAt(0)?.toUpperCase() || 'E'}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">{displayEmployeeName}</h2>
              <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono flex-wrap">
                <span>{displayEmployeeCode}</span>
                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                <span>{employee.designation || employee.department || 'Employee'}</span>
                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                <span className="text-indigo-400">
                  {selectedDate && new Date(selectedYear, selectedMonth - 1, selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-[#0a0a0a] p-1 rounded-xl border border-white/10">
              <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                Daily Record
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden flex-col md:flex-row">

          {/* Left column */}
          <div className="flex-1 p-6 overflow-y-auto border-r border-white/10 space-y-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-zinc-400 text-sm">Loading attendance details...</p>
              </div>
            )}

            {/* Leave mode */}
            {!loading && attendanceDetail?.type === 'leave' && (
              <div className="space-y-4">
                <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Leave Status</p>
                  <p className="text-yellow-400 font-bold text-2xl uppercase">{attendanceDetail.leave_details?.leave_type_display || 'ON LEAVE'}</p>
                </div>
                {attendanceDetail.leave_details && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black border border-white/10 rounded-xl p-4 space-y-3">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Leave Info</p>
                      <div className="flex justify-between"><span className="text-zinc-400 text-sm">Type</span><span className="text-amber-400 font-semibold text-sm">{attendanceDetail.leave_details.leave_type_display}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400 text-sm">Duration</span><span className="text-emerald-400 font-semibold text-sm">{attendanceDetail.leave_details.duration_days} day(s)</span></div>
                      <div className="flex justify-between"><span className="text-zinc-400 text-sm">Status</span><span className="text-emerald-400 font-semibold text-sm uppercase">{attendanceDetail.leave_details.status_display || attendanceDetail.leave_details.status}</span></div>
                    </div>
                    <div className="bg-black border border-white/10 rounded-xl p-4 space-y-3">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Approval</p>
                      <div className="flex justify-between"><span className="text-zinc-400 text-sm">Approved By</span><span className="text-indigo-400 font-semibold text-sm">{attendanceDetail.leave_details.approved_by_name || '—'}</span></div>
                      {attendanceDetail.leave_details.reason && (
                        <div>
                          <span className="text-zinc-400 text-xs block mb-1">Reason</span>
                          <p className="text-yellow-400 text-sm bg-white/5 rounded-lg p-2">{attendanceDetail.leave_details.reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 flex gap-3 items-start">
                  <span className="text-amber-400 text-lg">🏖️</span>
                  <div>
                    <p className="text-amber-400 font-semibold text-sm">Employee is on Leave</p>
                    <p className="text-zinc-400 text-xs mt-0.5">Attendance cannot be modified for approved leave days.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Regular attendance mode */}
            {!loading && attendanceDetail?.type !== 'leave' && (() => {
              const statusText = getStatusText(currentStatus)
              const statusColorClass =
                (attendanceDetail?.status_text || statusText)?.toUpperCase() === 'PRESENT' ? 'text-emerald-400' :
                (attendanceDetail?.status_text || statusText)?.toLowerCase().includes('half') ? 'text-amber-400' :
                (attendanceDetail?.status_text || statusText)?.toLowerCase().includes('absent') ||
                (attendanceDetail?.status_text || statusText)?.toLowerCase().includes('absconding') ? 'text-rose-400' :
                'text-indigo-400'

              const statusOptions = [
                { value: 'P',  label: 'FULL DAY',   num: '1',   dotClass: 'bg-emerald-500', badgeClass: 'bg-emerald-500 text-emerald-950' },
                { value: 'HD', label: 'HALF DAY',   num: '0.5', dotClass: 'bg-amber-400',   badgeClass: 'bg-amber-400 text-amber-950' },
                { value: 'A',  label: 'ABSENT',     num: '0',   dotClass: 'bg-zinc-500',    badgeClass: 'bg-zinc-800 text-zinc-400' },
                { value: 'AB', label: 'ABSCONDING', num: '-1',  dotClass: 'bg-rose-500',    badgeClass: 'bg-rose-500 text-rose-950' },
              ]
              const activeOpt = statusOptions.find(o => o.value === selectedAttendance)
              const isStatusChanged = !!selectedAttendance && selectedAttendance !== currentStatus

              return (
                <>
                  {/* Current Status Banner */}
                  <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-zinc-300 uppercase tracking-widest mb-1 font-semibold">Current Status</p>
                      <p className={`text-xl font-bold uppercase tracking-tight ${statusColorClass}`}>
                        {(attendanceDetail?.status_text || statusText || 'NOT MARKED').toUpperCase()}
                      </p>
                      {/* Detailed auto-reason message based on attendance settings */}
                      {(() => {
                        const att = attendanceDetail?.attendance_details || attendanceDetail
                        const statusTxt = (attendanceDetail?.status_text || statusText || '').toLowerCase()
                        const deadline = attendanceSettings?.reporting_deadline || '10:30'
                        const shiftEnd = attendanceSettings?.shift_end_time || '19:00'
                        const minFull = attendanceSettings?.full_day_working_hours || attendanceSettings?.minimum_working_hours_full_day || 9
                        const minHalf = attendanceSettings?.half_day_minimum_working_hours || attendanceSettings?.minimum_working_hours_half_day || 4.5
                        const abscondDays = attendanceSettings?.consecutive_absent_absconding_days || 2

                        const checkIn = att?.check_in_time || attendanceDetail?.check_in_time
                        const checkOut = att?.check_out_time || attendanceDetail?.check_out_time
                        const totalHours = att?.total_working_hours || attendanceDetail?.working_hours

                        const fmtTime = (t) => {
                          if (!t || t === '—') return null
                          const parts = t.split(':')
                          if (parts.length < 2) return t
                          let h = parseInt(parts[0], 10)
                          const m = parts[1]
                          const ap = h >= 12 ? 'PM' : 'AM'
                          h = h % 12 || 12
                          return `${h}:${m} ${ap}`
                        }
                        const fmtDeadline = fmtTime(deadline)
                        const fmtShiftEnd = fmtTime(shiftEnd)

                        const isLateCheckIn = checkIn && deadline && checkIn.slice(0,5) > deadline
                        const isEarlyCheckOut = checkOut && shiftEnd && checkOut.slice(0,5) < shiftEnd
                        const hrs = totalHours ? parseFloat(totalHours).toFixed(1) : null

                        let reasons = []

                        if (statusTxt.includes('absconding')) {
                          reasons.push(`Absent ${abscondDays}+ consecutive days without approved leave → Absconding.`)
                        } else if (statusTxt === 'half day' || statusTxt.includes('half')) {
                          if (isLateCheckIn) {
                            reasons.push(`Late check-in at ${fmtTime(checkIn)} (deadline: ${fmtDeadline}).`)
                          }
                          if (isEarlyCheckOut) {
                            reasons.push(`Early check-out at ${fmtTime(checkOut)} (shift ends: ${fmtShiftEnd}).`)
                          }
                          if (hrs && parseFloat(hrs) < minFull) {
                            reasons.push(`Worked ${hrs}h — full day requires ${minFull}h.`)
                          }
                          if (checkIn && !checkOut) {
                            reasons.push(`Check-in at ${fmtTime(checkIn)}, no check-out recorded.`)
                          }
                          if (reasons.length === 0 && hrs) {
                            reasons.push(`Total: ${hrs}h (below ${minFull}h for full day).`)
                          }
                        } else if (statusTxt === 'absent' || statusTxt === 'a') {
                          if (att?.auto_absent_no_checkin || (!checkIn && !checkOut)) {
                            reasons.push(`No check-in or check-out recorded.`)
                          } else if (att?.auto_absent_no_checkout || (checkIn && !checkOut)) {
                            reasons.push(`Check-in at ${fmtTime(checkIn)}, but no check-out → Absent.`)
                          } else if (att?.auto_absent_late) {
                            reasons.push(`No check-in before ${fmtDeadline} deadline.`)
                          } else if (hrs && parseFloat(hrs) < minHalf) {
                            reasons.push(`Worked ${hrs}h — minimum ${minHalf}h required for half day.`)
                          } else {
                            reasons.push(`Marked as Absent.`)
                          }
                        } else if (statusTxt.includes('present') || statusTxt === 'full day') {
                          // Present — no reason needed
                        } else if (!checkIn && !checkOut && !statusTxt.includes('holiday') && !statusTxt.includes('leave')) {
                          reasons.push(`No attendance record for this day.`)
                        }

                        if (reasons.length === 0) return null
                        return (
                          <div className="mt-2 space-y-1">
                            {reasons.map((r, i) => (
                              <p key={i} className="text-[11px] text-zinc-300 leading-snug flex items-start gap-1.5">
                                <span className="text-zinc-500 mt-px shrink-0">•</span>
                                <span>{r}</span>
                              </p>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-zinc-300 uppercase tracking-widest mb-1 font-semibold">Total Hours</p>
                      <p className="text-xl font-mono text-zinc-200">
                        {attendanceDetail?.attendance_details?.total_working_hours || attendanceDetail?.working_hours || '—'}
                      </p>
                    </div>
                  </div>

                  {/* System auto-remark (auto-absent reason, late comment, etc.) */}
                  {(() => {
                    const remarkText = attendanceDetail?.comments || attendanceDetail?.attendance_details?.comments
                    if (!remarkText || remarkText === 'None' || remarkText === 'null') return null
                    return (
                      <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3 flex gap-2.5 items-start">
                        <span className="text-indigo-400 text-base mt-0.5 shrink-0">🤖</span>
                        <div>
                          <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-1">System Remark</p>
                          <p className="text-indigo-100 text-xs leading-relaxed">{remarkText}</p>
                        </div>
                      </div>
                    )
                  })()}

                  {/* User-added comments */}
                  {comments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Comments ({comments.length})</p>
                      {comments.map((c, i) => (
                        <div key={c._id || i} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-1">
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-emerald-400 text-[11px] font-semibold">{c.user_name || c.username || 'HR'}</span>
                            <span className="text-zinc-600 text-[10px] font-mono">{c.created_at ? formatDateTime(c.created_at) : ''}</span>
                          </div>
                          <p className="text-zinc-200 text-xs leading-relaxed">{c.content || c.comment || c.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Check In / Check Out */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Check In */}
                    <div className="bg-black border border-white/10 rounded-xl p-3 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Check In</span>
                        <span className="text-xs font-mono text-zinc-400">{formatTime12h(attendanceDetail?.check_in_time || attendanceDetail?.attendance_details?.check_in_time || '—')}</span>
                      </div>
                      <div className="aspect-square rounded-lg bg-[#0a0a0a] border border-white/5 overflow-hidden relative group flex items-center justify-center">
                        {(attendanceDetail?.check_in_photo_path || attendanceDetail?.check_in_photo || attendanceDetail?.attendance_details?.check_in_photo_path) ? (
                          <img
                            src={`${BASE_URL}/${attendanceDetail.check_in_photo_path || attendanceDetail.check_in_photo || attendanceDetail.attendance_details?.check_in_photo_path}`}
                            alt="Check-in"
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                            onError={(e) => { e.target.style.display = 'none' }}
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-center">
                            <User className="w-8 h-8 text-zinc-700" />
                            <p className="text-zinc-600 text-xs">No photo</p>
                          </div>
                        )}
                      </div>
                      {attendanceDetail?.check_in_geolocation?.address && attendanceDetail.check_in_geolocation.address !== 'Unknown' && (
                        <p className="text-xs text-zinc-500 truncate">📍 {attendanceDetail.check_in_geolocation.address}</p>
                      )}
                    </div>

                    {/* Check Out */}
                    <div className="bg-black border border-white/10 rounded-xl p-3 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-rose-400 font-bold uppercase tracking-widest">Check Out</span>
                        <span className="text-xs font-mono text-zinc-400">{formatTime12h(attendanceDetail?.check_out_time || attendanceDetail?.attendance_details?.check_out_time || '—')}</span>
                      </div>
                      <div className="aspect-square rounded-lg bg-[#0a0a0a] border border-white/5 overflow-hidden relative group flex items-center justify-center">
                        {(attendanceDetail?.check_out_photo_path || attendanceDetail?.check_out_photo || attendanceDetail?.attendance_details?.check_out_photo_path) ? (
                          <img
                            src={`${BASE_URL}/${attendanceDetail.check_out_photo_path || attendanceDetail.check_out_photo || attendanceDetail.attendance_details?.check_out_photo_path}`}
                            alt="Check-out"
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                            onError={(e) => { e.target.style.display = 'none' }}
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-center">
                            <User className="w-8 h-8 text-zinc-700" />
                            <p className="text-zinc-600 text-xs">No photo</p>
                          </div>
                        )}
                      </div>
                      {attendanceDetail?.check_out_geolocation?.address && attendanceDetail.check_out_geolocation.address !== 'Unknown' && (
                        <p className="text-xs text-zinc-500 truncate">📍 {attendanceDetail.check_out_geolocation.address}</p>
                      )}
                    </div>
                  </div>

                  {/* Update Record */}
                  {hasEditPermission() && (
                    <div className="space-y-4 pt-4 border-t border-white/10">
                      <h4 className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Update Record</h4>

                      {/* Status Dropdown */}
                      <div className="relative" ref={statusDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                          className="w-full bg-black border border-white/10 hover:border-indigo-500/50 rounded-lg px-4 py-3 flex items-center justify-between transition-colors focus:outline-none"
                        >
                          <span className="text-sm font-medium text-zinc-200">
                            {activeOpt ? activeOpt.label : 'Select Attendance Status'}
                          </span>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform duration-200 ${statusDropdownOpen ? 'rotate-180' : ''}`}>
                            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500" />
                          </svg>
                        </button>
                        {statusDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a0a] border border-white/10 rounded-lg shadow-2xl overflow-hidden z-20">
                            {statusOptions.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => { setSelectedAttendance(opt.value); setStatusDropdownOpen(false) }}
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                              >
                                <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${opt.badgeClass}`}>
                                  {opt.num}
                                </div>
                                <span className="text-sm font-medium text-zinc-200">{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Remark — only shown when status is changed, mandatory */}
                      <div className={`overflow-hidden transition-all duration-300 ${isStatusChanged ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                        <textarea
                          value={updateReason}
                          onChange={(e) => setUpdateReason(e.target.value)}
                          placeholder="Mandatory remark for status change..."
                          rows={3}
                          className={`w-full bg-black border rounded-lg p-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none ${updateReason.trim() === '' ? 'border-rose-500/50' : 'border-white/10'}`}
                        />
                        {updateReason.trim() === '' && (
                          <p className="text-xs text-rose-400 font-semibold mt-2 flex items-center gap-1">
                            <span>⚠</span> Remark is required to update status
                          </p>
                        )}
                      </div>

                      <button
                        onClick={handleConfirmUpdate}
                        disabled={loading || !isStatusChanged || updateReason.trim() === ''}
                        className={`w-full py-3 rounded-lg font-bold text-xs tracking-widest uppercase transition-all duration-300 flex items-center justify-center gap-2
                          ${(loading || !isStatusChanged || updateReason.trim() === '')
                            ? 'bg-white/5 text-zinc-600 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.2)]'
                          }`}
                      >
                        {loading ? 'Updating...' : 'Update Attendance'}
                      </button>
                    </div>
                  )}
                </>
              )
            })()}
          </div>

          {/* Right: Activity History */}
          <div className="w-full md:w-80 bg-black flex flex-col flex-shrink-0">
            <div className="flex items-center gap-2 px-4 py-4 border-b border-white/10">
              <History className="w-4 h-4 text-indigo-400" />
              <span className="text-zinc-300 font-bold text-xs tracking-widest uppercase">Activity History</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
              {history.length > 0 ? (
                history.map((record, index) => {
                  const editorName = getDisplayEditorName(record)
                  const isAuto = String(record.action_type || record.action || '').toLowerCase().includes('auto')
                  const hasValues = record.old_value !== undefined && record.old_value !== null
                  const histStatusLabel = (val) => {
                    const n = parseFloat(val)
                    if (n === 1 || val === 'P')    return { text: 'Present',     color: '#10b981' }
                    if (n === 0.5 || val === 'HD') return { text: 'Half Day',    color: '#f59e0b' }
                    if (n === 0 || val === 'LV')   return { text: 'Leave',       color: '#f97316' }
                    if (n === -1 || val === 'A')   return { text: 'Absent',      color: '#71717a' }
                    if (n === -2 || val === 'AB')  return { text: 'Absconding',  color: '#ef4444' }
                    return { text: String(val ?? '—'), color: '#a1a1aa' }
                  }
                  const oldInfo = hasValues ? histStatusLabel(record.old_value) : null
                  const newInfo = hasValues ? histStatusLabel(record.new_value) : null
                  // Clean up action text: remove redundant "by [Name]" and changes list
                  const actionType = record.action_type || ''
                  const cleanAction = (() => {
                    const raw = String(record.action || '')
                    if (actionType === 'attendance_created') return 'Attendance marked'
                    if (actionType === 'attendance_edited') return 'Attendance updated'
                    if (actionType === 'comment_added') return 'Comment added'
                    // Generic: strip "by [Name]: details" part
                    const colonIdx = raw.indexOf(':')
                    const byIdx = raw.toLowerCase().indexOf(' by ')
                    if (byIdx > 0 && colonIdx > byIdx) return raw.slice(0, byIdx).trim()
                    if (byIdx > 0) return raw.slice(0, byIdx).trim()
                    return raw
                  })()
                  return (
                    <div key={record._id || index} style={{ background: '#0d0d10', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px' }}>
                      {/* Top row: timestamp + editor badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                        <span style={{ color: '#71717a', fontSize: '10px', fontFamily: 'monospace' }}>
                          {(record.changed_at || record.created_at) ? formatDateTime(record.changed_at || record.created_at) : '—'}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '20px', background: isAuto ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)', color: isAuto ? '#818cf8' : '#34d399', border: isAuto ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(16,185,129,0.3)' }}>
                          {editorName}
                        </span>
                      </div>
                      {/* Action text (cleaned) */}
                      <p style={{ color: '#e4e4e7', fontSize: '12px', lineHeight: '1.5', margin: 0, marginBottom: (hasValues || record.reason) ? '8px' : 0 }}>{cleanAction}</p>
                      {/* Status change badges */}
                      {hasValues && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: record.reason ? '8px' : 0 }}>
                          {oldInfo && <span style={{ color: oldInfo.color, background: oldInfo.color + '1a', border: `1px solid ${oldInfo.color}40`, fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>{oldInfo.text}</span>}
                          <span style={{ color: '#52525b', fontSize: '13px' }}>→</span>
                          {newInfo && <span style={{ color: newInfo.color, background: newInfo.color + '1a', border: `1px solid ${newInfo.color}40`, fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>{newInfo.text}</span>}
                        </div>
                      )}
                      {/* Reason */}
                      {record.reason && (
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '7px 10px' }}>
                          <p style={{ color: '#a1a1aa', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 3px' }}>Reason</p>
                          <p style={{ color: '#d4d4d8', fontSize: '11px', lineHeight: '1.5', margin: 0 }}>{record.reason}</p>
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50 py-12">
                  <History className="w-8 h-8 text-zinc-600" />
                  <p className="text-xs text-zinc-500 uppercase tracking-widest">No history for this date</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// Returns numeric value for a day status cell
const getDayNumericValue = (status) => {
  switch (status) {
    case "P": return 1
    case "L": return 1     // Late counts as full present
    case "HD": return 0.5
    case "WK": return 1    // Working/checked-in today — counts as present
    case "LV": return 0    // Leave counts as 0 in present score (paid separately via plDays)
    case "AB": return -1   // Absconding reduces score
    case "A": return 0     // Absent = 0, not a penalty (day simply not earned)
    case "SP": return 1    // Sunday Paid — full day paid
    case "S0": return 0    // Sunday Zero — not paid, not penalized
    case "H": return null  // Holiday – excluded from present calc
    case "W": return null  // Weekend – excluded
    default: return null   // Not marked – excluded
  }
}

const calculateMonthlyStats = (record, selectedYear, selectedMonth, daysInMonth, holidays) => {
  let presentScore = 0
  let actualPresent = 0  // Only positive-value days (P, L, SP, HD, WK) — for display
  let lvDaysTaken = 0  // Leave days taken (LV status) — counted for reference only
  let absconding = 0
  let absentDays = 0   // Pure absent days (A status)
  let holidaysCount = 0

  // ── Joining date: days before joining are blacked out (null) and don't count ──
  const joiningRaw = record.joining_date || record.date_of_joining || null
  let joiningDay = 0 // 0 = full month (no mid-month join)
  if (joiningRaw) {
    const jStr = typeof joiningRaw === 'string' ? joiningRaw.substring(0, 10) : ''
    const jYear  = parseInt(jStr.substring(0, 4), 10)
    const jMonth = parseInt(jStr.substring(5, 7), 10) // 1-based
    const jDay   = parseInt(jStr.substring(8, 10), 10)
    if (jYear === selectedYear && jMonth === selectedMonth && jDay > 1) {
      joiningDay = jDay // employee joined mid-month this month
    }
  }
  // effectiveDays = days employee was eligible in this month
  const effectiveDays = joiningDay > 0 ? (daysInMonth - joiningDay + 1) : daysInMonth

  for (let day = 1; day <= daysInMonth; day++) {
    const status = record[`day${day}`]
    const val = getDayNumericValue(status)
    if (status === 'H') {
      holidaysCount++
    } else if (status === 'LV') {
      lvDaysTaken++
    } else if (status === 'AB') {
      // Absconding: day not earned (-1 vs present) + extra penalty (-1) = total -2
      presentScore -= 2
      absconding++
    } else if (status === 'A') {
      // Absent: day simply not earned — does NOT reduce score, just not added
      absentDays++
    } else if (val !== null) {
      presentScore += val
      if (val > 0) actualPresent += val  // count only actual present days
    }
  }

  // PL days: use the actual PL remaining from Leave Management (per-employee, per-period)
  // This is exactly what shows in the Leave Management tab — same data, same source.
  // paidLeavesRemaining = total PL allotted minus any PL already used = what's left.
  //
  // Display rule (PL column in calendar):
  //   - If Leave Management has a DB record → show paidLeavesRemaining (exact match with LM tab)
  //   - If no DB record (record.paidLeavesTotal is null/undefined) → show plMonthly default
  const plAllotted  = record.paidLeavesTotal    ?? record.plMonthly ?? 1  // total PL for this period
  const plUsed      = record.paidLeavesUsed     ?? 0                       // PL actually consumed
  const plRemaining = record.paidLeavesRemaining ?? null                   // remaining balance from LM

  // plDays shown in PL column = remaining balance (same as Leave Management tab)
  // Falls back to plAllotted if remaining is not available (no DB record yet)
  const plDays = plRemaining != null ? plRemaining : plAllotted

  console.log(`[ATT-PL] ${record.id} yr=${selectedYear} mo=${selectedMonth}`,
    { paidLeavesTotal: record.paidLeavesTotal, paidLeavesRemaining: record.paidLeavesRemaining,
      plAllotted, plRemaining, plDays });

  const elDays = 0
  const graceMonthly = record.graceMonthlyLimit != null ? record.graceMonthlyLimit : 0
  const graceRemainingMonthly = record.graceRemaining != null
    ? Math.min(record.graceRemaining, graceMonthly)
    : graceMonthly

  // Final = presentScore + PL days (shown in Final column)
  // Capped at daysInMonth (or effectiveDays for mid-month joiners) — can never exceed total days
  const rawFinal = Math.max(0, presentScore) + plDays
  const finalScore = Math.min(rawFinal, joiningDay > 0 ? effectiveDays : daysInMonth)

  const workingDays = daysInMonth - holidaysCount
  const attendancePercentage = workingDays > 0 ? ((Math.max(0, presentScore) / workingDays) * 100).toFixed(1) : "0"

  return {
    presentScore,
    actualPresent,
    plDays,
    elDays,
    graceRemaining: graceRemainingMonthly,
    graceTotal: graceMonthly,
    finalScore,
    effectiveDays,   // days employee was eligible this month
    absconding,
    absentDays,
    holidays: holidaysCount,
    workingDays,
    attendancePercentage,
    // Legacy compat
    present: presentScore,
    late: 0,
    leave: lvDaysTaken,
    halfDay: 0,
  }
}

export default function MonthlyAttendanceTable() {
  const _ist = getISTToday()

  const [pageTab, setPageTab] = useTabWithHistory('view', 'attendance', { localStorageKey: 'attendancePageTab' })
  const [selectedYear, setSelectedYear] = useState(_ist.year)
  const [selectedMonth, setSelectedMonth] = useState(_ist.month)
  const [attendanceData, setAttendanceData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [holidayModalOpen, setHolidayModalOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [user, setUser] = useState(null)
  const [permissions, setPermissions] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState("")
  const [history, setHistory] = useState([])
  const [holidays, setHolidays] = useState([])
  const [attendanceSettings, setAttendanceSettings] = useState({
    enable_sunday_sandwich_rule: true,
    enable_adjacent_absconding_rule: true,
    minimum_working_days_for_sunday: 5,
    auto_grace_monthly_limit: 3,
    grace_usage_limit: 3,
    default_earned_leave_monthly: 1.5,
    default_paid_leave_monthly: 1.0,
  })

  const [salaryModalOpen, setSalaryModalOpen] = useState(false)
  const [selectedSalaryData, setSelectedSalaryData] = useState(null)
  const [canViewSalaryState, setCanViewSalaryState] = useState(false)
  const [monthlyLeaves, setMonthlyLeaves] = useState([])
  const [leavesMap, setLeavesMap] = useState(new Map())
  const [editHistoryModalOpen, setEditHistoryModalOpen] = useState(false)
  const [selectedEmployeeHistory, setSelectedEmployeeHistory] = useState(null)
  const [editHistoryData, setEditHistoryData] = useState([])
  const [editCounts, setEditCounts] = useState({}) // { [empId]: count } — increments on each edit
  const [modalLoading, setModalLoading] = useState(false) // secondary loading (modal fetch) — does NOT replace full page
  const [searchQuery, setSearchQuery] = useState('')
  useNavbarPageSearch(setSearchQuery)
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false)
  const [teamFilter, setTeamFilter] = useState('')
  const [empStatusFilter, setEmpStatusFilter] = useState('active') // 'all' | 'active' | 'inactive'
  const [empStatusDropdownOpen, setEmpStatusDropdownOpen] = useState(false)
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)
  const [teamSearchText, setTeamSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortConfig, setSortConfig] = useState({ key: 'employeeId', dir: 'asc' })
  // warningPenaltiesMap: { [mongoId]: { total_penalty: number, penalties: [] } }
  const [warningPenaltiesMap, setWarningPenaltiesMap] = useState({})
  // financeDeductionsMap: { [mongoId]: [{ _id, deduction_type, amount, date, description, status }] }
  const [financeDeductionsMap, setFinanceDeductionsMap] = useState({})
  const [deductionModalOpen, setDeductionModalOpen] = useState(false)
  const [selectedDeductionData, setSelectedDeductionData] = useState(null)

  // Inline edit state for Individual Target (settled_target)
  const [editingIndividualTarget, setEditingIndividualTarget] = useState(null)  // record.id being edited
  const [individualTargetValue, setIndividualTargetValue] = useState('')        // input value while editing
  const [individualTargetSaving, setIndividualTargetSaving] = useState(null)   // record.id being saved

  const handleIndividualTargetEdit = (record) => {
    setEditingIndividualTarget(record.id)
    setIndividualTargetValue(record.settledTarget > 0 ? String(record.settledTarget) : '')
  }

  const handleIndividualTargetSave = async (record) => {
    const newValue = parseFloat(individualTargetValue) || 0
    setIndividualTargetSaving(record.id)
    try {
      // Save per-month settled_target (not overwriting the live employee field)
      // This ensures each month has its own individual target
      await axios.post(
        `${BASE_URL}/employee-monthly-config/upsert`,
        {
          employee_id: record.mongoId || record.id,
          year: selectedYear,
          month: selectedMonth - 1,  // 0-indexed for consistency with SalaryManagement
          settled_target: newValue
        },
        { params: { user_id: user.user_id }, headers: getAuthHeaders() }
      )
      // Update local state so table refreshes immediately without a full reload
      setAttendanceData(prev => prev.map(r =>
        (r.id === record.id || r.mongoId === record.mongoId)
          ? { ...r, settledTarget: newValue }
          : r
      ))
      setEditingIndividualTarget(null)
    } catch (err) {
      console.error('Failed to save individual target:', err)
      alert('Failed to save. Please try again.')
    } finally {
      setIndividualTargetSaving(null)
    }
  }

  const handleIndividualTargetKeyDown = (e, record) => {
    if (e.key === 'Enter') handleIndividualTargetSave(record)
    if (e.key === 'Escape') setEditingIndividualTarget(null)
  }

  // Apply attendance rules to formatted records
  // NOTE: The backend already applies Sunday sandwich & absconding rules.
  // This frontend rule only handles remaining Sundays that came as 'W' (weekend dash)
  // and decides if they should be SP (Sunday Paid) when enough present days exist.
  const applyAttendanceRules = (records, settings, year, month) => {
    if (!settings) return records
    const MIN_DAYS_FOR_SUNDAY = settings?.minimum_working_days_for_sunday ?? 4
    return records.map(record => {
      const updated = { ...record }
      const daysInM = new Date(year, month, 0).getDate()

      for (let d = 1; d <= daysInM; d++) {
        const dateObj = new Date(year, month - 1, d)
        if (dateObj.getDay() !== 0) continue // Only process Sundays

        const currentSunValue = updated[`day${d}`]
        // Backend already decided this Sunday (A, AB, SP, S0, LV, H) — don't override
        if (currentSunValue && currentSunValue !== 'W') continue

        // Also skip if admin manually overrode this Sunday in this session
        if (updated[`day${d}_manualOverride`]) continue

        // Only process Sundays still marked as 'W' (weekend dash / not yet decided)
        const satDay = d - 1
        const monDay = d + 1

        // Count present days Mon-Sat (P, L, HD, WK count as attendance; H counts too)
        let presentDays = 0
        let hasAnyData = false
        for (let w = Math.max(1, d - 6); w <= Math.min(daysInM, d - 1); w++) {
          const wDow = new Date(year, month - 1, w).getDay()
          if (wDow === 0) continue
          const s = updated[`day${w}`]
          if (s === 'P' || s === 'L' || s === 'HD' || s === 'AB' || s === 'LV' || s === 'WK' || s === 'A') hasAnyData = true
          if (s === 'P' || s === 'L' || s === 'HD' || s === 'H' || s === 'WK') presentDays++
        }
        if (monDay <= daysInM) {
          const ms = updated[`day${monDay}`]
          if (ms === 'P' || ms === 'L' || ms === 'HD' || ms === 'AB' || ms === 'LV' || ms === 'WK' || ms === 'A') hasAnyData = true
        }
        if (!hasAnyData) continue // No data yet — keep as W

        // Sunday paid only if minimum 4 present days
        if (presentDays >= MIN_DAYS_FOR_SUNDAY) {
          updated[`day${d}`] = 'SP'
        }
      }

      return updated
    })
  }
  const tableScrollRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Get user info from localStorage
  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
    }
  }, [])

  // pageTab is now auto-persisted via useTabWithHistory hook

  // Load holidays when user is available
  useEffect(() => {
    const loadHolidays = async () => {
      if (!user?.user_id) return
      
      try {
        const response = await attendanceAPI.getHolidays(selectedYear, null, user.user_id)
        if (response.success) {
          setHolidays(response.holidays || [])
        }
      } catch (error) {
        console.error('Error loading holidays:', error)
        // Keep default holidays as fallback
        setHolidays([
          { _id: "1", date: "2025-01-01", name: "New Year's Day" },
          { _id: "2", date: "2025-01-26", name: "Republic Day" },
          { _id: "3", date: "2025-08-15", name: "Independence Day" },
          { _id: "4", date: "2025-12-25", name: "Christmas Day" },
        ])
      }
    }

    if (user?.user_id) {
      loadHolidays()
    }
  }, [user, selectedYear])

  // Fetch user permissions
  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user?.user_id) return
      
      try {
        const perms = await attendanceAPI.getPermissions(user.user_id)
        setPermissions(perms)
      } catch (error) {
        console.error('Error fetching permissions:', error)
        // Set default permissions for non-admin users
        setPermissions({ can_view_all: false })
      }
    }

    fetchPermissions()
  }, [user])

  // Scroll functions for horizontal table navigation
  const updateScrollButtons = useCallback(() => {
    if (tableScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tableScrollRef.current
      console.log('Scroll Debug:', { scrollLeft, scrollWidth, clientWidth, canScroll: scrollWidth > clientWidth })
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
    }
  }, [])

  const scrollTable = useCallback((direction) => {
    if (tableScrollRef.current) {
      const scrollAmount = 300
      tableScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
      setTimeout(updateScrollButtons, 100)
    }
  }, [updateScrollButtons])

  // Set up scroll listener for table navigation buttons
  useEffect(() => {
    updateScrollButtons()
    const tableContainer = tableScrollRef.current
    if (tableContainer) {
      tableContainer.addEventListener('scroll', updateScrollButtons)
      return () => {
        tableContainer.removeEventListener('scroll', updateScrollButtons)
      }
    }
  }, [updateScrollButtons])

  // Update scroll buttons when attendance data changes
  useEffect(() => {
    setTimeout(updateScrollButtons, 100)
  }, [attendanceData, updateScrollButtons])

  // Simplified permission checking using new 3-type system
  const permissionLevel = getPermissionLevel('attendance');
  const currentUserId = getCurrentUserId();

  // Leave Management tab visibility
  const canShowLeaveManagement = (() => {
    const userPermissions = getUserPermissions();
    if (isSuperAdmin(userPermissions)) return true;
    return hasPermission(userPermissions, 'attendance', 'leave_management') ||
           hasPermission(userPermissions, 'leave_management', 'show') ||
           hasPermission(userPermissions, 'leaves', 'show');
  })();

  // Salary column visibility — requires EXPLICIT 'view_salary' permission on attendance.
  // Wildcards ('*' actions) do NOT grant this; it must be explicitly assigned.
  const computeCanViewSalary = () => {
    try {
      const raw = localStorage.getItem('userPermissions');
      if (!raw) return false;
      const userPermissions = JSON.parse(raw);
      // SuperAdmin: pages:"*" && actions:"*"
      if (userPermissions && typeof userPermissions === 'object' && !Array.isArray(userPermissions)) {
        if (userPermissions['pages'] === '*' && userPermissions['actions'] === '*') return true;
        if (userPermissions['*'] === '*') return true;
      }
      // Array format (new backend format): explicit check only, skip wildcards
      if (Array.isArray(userPermissions)) {
        // SuperAdmin in array format: {page:'*', actions:'*'}
        if (userPermissions.some(p => p && p.page === '*' && (p.actions === '*' || (Array.isArray(p.actions) && p.actions.includes('*'))))) return true;
        // Explicit view_salary check
        return userPermissions.some(perm => {
          if (!perm || perm.page !== 'attendance') return false;
          return Array.isArray(perm.actions) && perm.actions.includes('view_salary');
        });
      }
      // Legacy object format: {attendance: {show:true, view_salary:true}}
      if (userPermissions && typeof userPermissions === 'object') {
        const att = userPermissions['attendance'] || userPermissions['Attendance'];
        if (!att) return false;
        if (att === '*') return false; // wildcard attendance does NOT grant salary
        if (Array.isArray(att)) return att.includes('view_salary');
        if (typeof att === 'object') return att['view_salary'] === true;
      }
    } catch (e) { /* ignore */ }
    return false;
  };

  useEffect(() => {
    setCanViewSalaryState(computeCanViewSalary());
    const handler = () => setCanViewSalaryState(computeCanViewSalary());
    window.addEventListener('permissionsUpdated', handler);
    return () => window.removeEventListener('permissionsUpdated', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canViewSalary = canViewSalaryState;
  
  // Permission check functions  
  const canUserViewAll = () => canViewAll('attendance');
  const canUserViewJunior = () => canViewJunior('attendance');
  const canUserCreate = () => canCreate('attendance');
  const canUserEdit = (recordOwnerId) => {
    // Get user permissions from localStorage
    const userPermissions = getUserPermissions();
    
    // Superadmin with wildcard (*) can always edit attendance
    if (isSuperAdmin(userPermissions)) {
      return true;
    }
    
    // STRICT CHECK: User must have explicit 'update' action in attendance permissions
    // Uses hasPermission which handles both object and array permission formats
    return hasPermission(userPermissions, 'attendance', 'update');
  };
  const canUserDelete = (recordOwnerId) => canDelete('attendance', recordOwnerId);

  // Legacy compatibility functions
  const isAdmin = () => canUserViewAll();
  const hasAdminPermissions = () => canUserViewAll();
  
  // Legacy compatibility for the old canViewAll function
  const canViewAllRecords = () => canUserViewAll();

  // Convert API response to calendar format and merge with HRMS employees
  const convertToCalendarFormat = (apiData, activeEmployeeIds = null, salaryMap = {}, employeeStatusMap = {}, allHrmsEmployees = [], monthlyTargetMap = {}, settledTargetMap = {}) => {
    console.log('🔍 Total employees from attendance API:', apiData?.employees?.length || 0);
    console.log('🔍 Total HRMS employees:', allHrmsEmployees.length);

    const hrmsLookup = new Map();
    allHrmsEmployees.forEach(emp => {
      const keys = [emp.employee_id, emp._id].filter(Boolean).map(String)
      keys.forEach(k => hrmsLookup.set(k, emp))
    })

    // Process attendance API employees
    const attendanceEmployeeIds = new Set();
    const filtered = (apiData?.employees || [])
      .filter(employee => {
        const hasAttendance = employee.days && employee.days.some(day => {
          const status = parseFloat(day.status);
          return status === 1.0 || status === 1 ||
                 status === 2.0 || status === 2 ||
                 status === 0.5 ||
                 status === 0 || status === 0.0 ||
                 status === -2 || status === -2.0 ||
                 day.status === "L";
        });

        if (activeEmployeeIds && activeEmployeeIds.size > 0) {
          const empId = employee.employee_id;
          const isActiveEmployee = activeEmployeeIds.has(empId) || 
                                   activeEmployeeIds.has(String(empId)) || 
                                   activeEmployeeIds.has(Number(empId));
          return isActiveEmployee || hasAttendance;
        }
        return hasAttendance;
      })
      .map(employee => {
        attendanceEmployeeIds.add(employee.employee_id);
        attendanceEmployeeIds.add(String(employee.employee_id));
        return employee;
      })
      .map(employee => {
      // Create a record for each employee with day status mapping
      // Look up salary from salary map using multiple ID formats
      const empId = employee.employee_id;
      const hrmsEmp = hrmsLookup.get(String(empId)) || hrmsLookup.get(String(employee.user_mongo_id || ''))
      const empSalary = salaryMap[empId] || salaryMap[String(empId)] || 0;
      
      // Determine employee active status from HRMS employee status map, with attendance API as fallback
      const empStatus = employeeStatusMap[empId] || employeeStatusMap[String(empId)] || employee.employee_status;
      const isActiveEmp = empStatus
        ? (empStatus === 'active')
        : (!activeEmployeeIds || activeEmployeeIds.size === 0
          ? true
          : activeEmployeeIds.has(empId) || activeEmployeeIds.has(String(empId)) || activeEmployeeIds.has(Number(empId)));

      const hrmsName = [hrmsEmp?.first_name, hrmsEmp?.last_name].filter(Boolean).join(' ').trim()
      const resolvedName = hrmsName || employee.employee_name || hrmsEmp?.name || hrmsEmp?.username || String(empId)
      const resolvedDesignation = employee.designation || hrmsEmp?.designation || ''
      const resolvedJoiningDate = employee.joining_date || hrmsEmp?.joining_date || hrmsEmp?.date_of_joining || ''
      // Inactive-from date: set by backend when employee is deactivated
      const resolvedInactiveFrom = hrmsEmp?.inactive_from_date || employee.inactive_from_date || null

      const monthlyTarget = monthlyTargetMap[empId] || monthlyTargetMap[String(empId)] || 0;
      const settledTarget = settledTargetMap[empId] || settledTargetMap[String(empId)] || 0;
      
      const employeeRecord = {
        id: employee.employee_id,
        mongoId: employee.user_mongo_id || employee.employee_id, // MongoDB _id for history API calls
        name: resolvedName,
        employeeId: employee.employee_id || employee.employee_code || employee.employee_number || employee.empId || 'N/A',
        department: employee.department_name || "Unknown Department",
        role: employee.role_name || "",
        designation: resolvedDesignation,
        joining_date: resolvedJoiningDate,
        inactive_from_date: resolvedInactiveFrom,
        photo: employee.employee_photo,
        salary: empSalary,
        monthlyTarget: monthlyTarget,
        settledTarget: settledTarget,
        isActive: isActiveEmp
      };

        // Map each day's status to the expected format
        employee.days.forEach(day => {
          const dayKey = `day${day.day}`;
          
          // Handle the status mapping properly
          if (day.status !== null && day.status !== undefined) {
            // Handle both numeric and string statuses
            const status = parseFloat(day.status);
            
            if (status === 1.5) {
              employeeRecord[dayKey] = 'H'; // Holiday (new status format from backend)
            } else if (status === 2.0 || status === 2) {
              employeeRecord[dayKey] = 'WK'; // Working / Checked-in today, no checkout yet
            } else if (status === 1.0 || status === 1) {
              // Sunday Present → blue (SP), regular present → green (P)
              employeeRecord[dayKey] = day.is_weekend ? 'SP' : 'P';
            } else if (status === 0.5) {
              employeeRecord[dayKey] = 'HD'; // Half Day (different from holiday)
            } else if (status === 0 || status === 0.0) {
              // Sunday Absent → S0, leave → LV
              employeeRecord[dayKey] = day.is_weekend ? 'S0' : 'LV';
            } else if (status === -1 || status === -1.0) {
              employeeRecord[dayKey] = 'A'; // Absent (white bg, black "0")
            } else if (status === -2 || status === -2.0) {
              employeeRecord[dayKey] = 'AB'; // Absconding
            } else if (day.status === "L") {
              employeeRecord[dayKey] = 'L'; // Late
            } else {
              employeeRecord[dayKey] = ''; // Default empty
            }
          } else if (day.is_holiday) {
            employeeRecord[dayKey] = 'H'; // Holiday takes priority — even on Sunday
          } else if (day.is_weekend) {
            employeeRecord[dayKey] = 'W'; // Weekend (non-holiday)
          } else {
            employeeRecord[dayKey] = ''; // null status = today/future (not yet marked)
          }
        });      return employeeRecord;
    });
    
    // Add HRMS employees that are NOT in attendance data (placeholder records)
    const hrmsOnlyRecords = allHrmsEmployees
      .filter(emp => {
        const empId = emp.employee_id || emp._id;
        return empId && !attendanceEmployeeIds.has(empId) && !attendanceEmployeeIds.has(String(empId));
      })
      .map(emp => {
        const empId = emp.employee_id || emp._id;
        const empStatus = employeeStatusMap[empId] || employeeStatusMap[String(empId)];
        const isActiveEmp = empStatus ? (empStatus === 'active') : (emp.employee_status ? emp.employee_status === 'active' : emp.is_active !== false);
        const empSalary = salaryMap[empId] || salaryMap[String(empId)] || 0;
        const empMonthlyTarget = monthlyTargetMap[empId] || monthlyTargetMap[String(empId)] || 0;
        const empSettledTarget = settledTargetMap[empId] || settledTargetMap[String(empId)] || 0;
        const empName = [emp.first_name, emp.last_name].filter(Boolean).join(' ') || emp.username || 'Unknown';
        return {
          id: empId,
          mongoId: emp._id || empId,
          name: empName,
          employeeId: emp.employee_id || emp.username || 'N/A',
          department: emp.department_name || "Unknown Department",
          role: emp.designation || "",
          designation: emp.designation || "",
          joining_date: emp.joining_date || emp.date_of_joining || "",
          inactive_from_date: emp.inactive_from_date || null,
          photo: emp.profile_photo,
          salary: empSalary,
          monthlyTarget: empMonthlyTarget,
          settledTarget: empSettledTarget,
          isActive: isActiveEmp
        };
      });

    const allRecords = [...filtered, ...hrmsOnlyRecords];
    console.log('✅ Attendance records:', filtered.length, '+ HRMS-only:', hrmsOnlyRecords.length, '= Total:', allRecords.length);
    return allRecords;
  };

  // Fetch attendance data when component mounts or month changes
  const fetchAttendanceData = useCallback(async () => {
      if (!user?.user_id) return
      
      setLoading(true)
      setError(null)
      setEditCounts({}) // Reset edit counts when month/year changes
      setWarningPenaltiesMap({}) // Reset warning penalties when month/year changes
      
      try {
        // Fetch ALL employees (active + inactive) from Employee page for status filtering
        let activeEmployeeIds = null;
        const salaryMap = {};
        const employeeStatusMap = {};
        const monthlyTargetMap = {};
        const settledTargetMap = {};
        let allHrmsEmployees = [];
        try {
          const employeesResponse = await hrmsService.getEmployees('all');
          if (employeesResponse?.data) {
            allHrmsEmployees = employeesResponse.data;
            console.log('📊 All employees from HRMS:', allHrmsEmployees.length);
            
            // Build employee status map for all employees
            activeEmployeeIds = new Set();
            employeesResponse.data.forEach(emp => {
              const empId = emp.employee_id || emp._id;
              const isActive = emp.employee_status ? emp.employee_status === 'active' : emp.is_active !== false;
              const status = isActive ? 'active' : 'inactive';
              if (empId) {
                // Status map for accurate active/inactive filtering
                employeeStatusMap[empId] = status;
                employeeStatusMap[String(empId)] = status;
                // Active set for backward compatibility (filtering in convertToCalendarFormat)
                if (isActive) {
                  activeEmployeeIds.add(empId);
                  activeEmployeeIds.add(String(empId));
                  activeEmployeeIds.add(Number(empId));
                }
              }
            });
            
            console.log('✅ Active employees:', Array.from(activeEmployeeIds).length / 3);
            console.log('📋 Status map entries:', Object.keys(employeeStatusMap).length / 2);
            
            // Build salary map and target maps from same employee data (no extra API call)
            // settled_target from employee document is used as the initial fallback.
            // Per-month config (if saved) will override this below.
            employeesResponse.data.forEach(emp => {
              const eid = emp.employee_id || emp._id;
              const mongoId = emp._id || emp.employee_id;
              const sal = parseFloat(emp.salary) || 0;
              const monthlyTarget = parseFloat(emp.monthly_target) || 0;
              const settledTarget = parseFloat(emp.settled_target) || 0;
              if (eid && sal > 0) {
                salaryMap[eid] = sal;
                salaryMap[String(eid)] = sal;
              }
              if (eid) {
                monthlyTargetMap[eid] = monthlyTarget;
                monthlyTargetMap[String(eid)] = monthlyTarget;
                // Use employee document value as fallback — per-month config will override below
                settledTargetMap[eid] = settledTarget;
                settledTargetMap[String(eid)] = settledTarget;
              }
              if (mongoId && mongoId !== eid) {
                if (sal > 0) { salaryMap[String(mongoId)] = sal; }
                monthlyTargetMap[String(mongoId)] = monthlyTarget;
                settledTargetMap[String(mongoId)] = settledTarget;
              }
            });

            // ── Fetch per-month settled_target overrides ──────────────────────
            // settled_target is per-month (entered in Attendance page each month)
            // Override the live employee value with the month-specific one if available
            try {
              const mongoIds = employeesResponse.data.map(e => String(e._id)).filter(Boolean);
              if (mongoIds.length > 0) {
                const cfResp = await axios.get(
                  `${BASE_URL}/employee-monthly-config/bulk`,
                  {
                    params: {
                      user_id: user.user_id,
                      year: selectedYear,
                      month: selectedMonth - 1,  // 0-indexed
                      employee_ids: mongoIds.join(',')
                    },
                    headers: getAuthHeaders()
                  }
                )
                const cfData = cfResp.data?.data || {}
                const configuredIds = new Set(Object.keys(cfData))

                // ── Auto-migrate: if per-month config doesn't exist for this month,
                // seed it from the employee document's current settled_target.
                // This handles the transition from old (single-value) to new (per-month) system.
                const toMigrate = employeesResponse.data
                  .filter(emp => {
                    const mid = String(emp._id);
                    const hasConfig = configuredIds.has(mid);
                    const hasSettledTarget = parseFloat(emp.settled_target) > 0;
                    return !hasConfig && hasSettledTarget;
                  })
                  .map(emp => ({
                    employee_id: String(emp._id),
                    settled_target: parseFloat(emp.settled_target),
                    salary: parseFloat(emp.salary) || undefined,
                    monthly_target: parseFloat(emp.monthly_target) || undefined,
                  }));

                if (toMigrate.length > 0) {
                  // Fire-and-forget migration — don't await to avoid blocking
                  axios.post(
                    `${BASE_URL}/employee-monthly-config/migrate-from-employee-docs`,
                    { year: selectedYear, month: selectedMonth - 1, employees: toMigrate },
                    { params: { user_id: user.user_id }, headers: getAuthHeaders() }
                  ).catch(() => {});
                  // Use employee document values immediately (they'll be in DB next load)
                  toMigrate.forEach(emp => {
                    const mongoId = emp.employee_id;
                    settledTargetMap[mongoId] = emp.settled_target;
                    const hrmsEmp = employeesResponse.data.find(e => String(e._id) === mongoId);
                    if (hrmsEmp) {
                      const eid = hrmsEmp.employee_id || hrmsEmp._id;
                      settledTargetMap[eid] = emp.settled_target;
                      settledTargetMap[String(eid)] = emp.settled_target;
                    }
                  });
                }

                // Override settledTarget (and salary/monthlyTarget if set) with per-month values
                Object.entries(cfData).forEach(([mongoId, cfg]) => {
                  if (cfg.settled_target != null) {
                    settledTargetMap[mongoId] = cfg.settled_target;
                    const emp = employeesResponse.data.find(e => String(e._id) === mongoId);
                    if (emp) {
                      const eid = emp.employee_id || emp._id;
                      settledTargetMap[eid] = cfg.settled_target;
                      settledTargetMap[String(eid)] = cfg.settled_target;
                    }
                  }
                  if (cfg.salary != null) {
                    salaryMap[mongoId] = cfg.salary;
                    const emp = employeesResponse.data.find(e => String(e._id) === mongoId);
                    if (emp) { const eid = emp.employee_id || emp._id; salaryMap[eid] = cfg.salary; salaryMap[String(eid)] = cfg.salary; }
                  }
                  if (cfg.monthly_target != null) {
                    monthlyTargetMap[mongoId] = cfg.monthly_target;
                    const emp = employeesResponse.data.find(e => String(e._id) === mongoId);
                    if (emp) { const eid = emp.employee_id || emp._id; monthlyTargetMap[eid] = cfg.monthly_target; monthlyTargetMap[String(eid)] = cfg.monthly_target; }
                  }
                });
              }
            } catch (cfErr) {
              console.warn('Could not fetch per-month config, using live employee values:', cfErr);
            }
          }
        } catch (empError) {
          console.warn('⚠️ Could not fetch employee list, showing all attendance:', empError);
        }

        const response = await attendanceAPI.getCalendar(selectedYear, selectedMonth, user.user_id)

        // Fetch attendance settings for rules (includes EL/PL/grace monthly allotments)
        let settingsData = attendanceSettings
        try {
          const settingsResp = await axios.get(
            `${BASE_URL}/settings/attendance-settings`,
            { params: { user_id: user.user_id }, headers: getAuthHeaders() }
          )
          const incoming = settingsResp.data?.data || settingsResp.data || {}
          if (Object.keys(incoming).length > 0) {
            settingsData = { ...attendanceSettings, ...incoming }
            setAttendanceSettings(settingsData)
          }
        } catch (e) { /* use defaults */ }
        
        if (response && response.employees) {
          const formattedData = convertToCalendarFormat(response, activeEmployeeIds, salaryMap, employeeStatusMap, allHrmsEmployees, monthlyTargetMap, settledTargetMap)

          // Fetch leave balances for all employees in parallel (use selected month period)
          const leavePeriod = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
          const leaveBalanceResults = await Promise.allSettled(
            formattedData.map(record =>
              axios.get(`${BASE_URL}/settings/leave-balance/${record.mongoId || record.id}`, {
                params: { user_id: user.user_id, period: leavePeriod },
                headers: getAuthHeaders()
              }).then(res => ({ id: record.id, mongoId: record.mongoId, data: res.data?.data || {} }))
            )
          )

          // Merge leave balance data into each record
          const balanceMap = {}
          leaveBalanceResults.forEach((result, idx) => {
            if (result.status === 'fulfilled') {
              const payload = result.value
              const balData = payload?.data || payload
              const empRecord = formattedData[idx]
              // Only store if balData is a non-empty object (empty {} means no DB record — use null)
              if (empRecord && balData && typeof balData === 'object' && Object.keys(balData).length > 0) {
                balanceMap[empRecord.id] = balData
              }
            }
          })

          const enrichedData = formattedData.map(record => {
            const bal = balanceMap[record.id] ?? null
            // Debug: log Avesh specifically
            if (record.id === 'RM086' || (record.name && record.name.toLowerCase().includes('avesh'))) {
              console.log('🔍 AVESH bal:', JSON.stringify(bal), 'record.id:', record.id, 'balanceMap keys:', Object.keys(balanceMap).filter(k => k.includes('RM08')))
            }
            return {
              ...record,
              // Use exact leave management values — no settings fallback so 0 stays 0
              earnedLeavesTotal:     bal != null ? (bal.earned_leaves_total     ?? 0) : 0,
              earnedLeavesUsed:      bal != null ? (bal.earned_leaves_used      ?? 0) : 0,
              earnedLeavesRemaining: bal != null ? (bal.earned_leaves_remaining ?? 0) : 0,
              // PL: use DB balance if available (0 is valid — employee has 0 PL), else fall back to settings default
              // IMPORTANT: bal=null means no DB record at all (use default), bal.paid_leaves_total=0 means 0 PL (keep 0)
              paidLeavesTotal:       bal != null ? (bal.paid_leaves_total       ?? settingsData.default_paid_leave_monthly ?? 1) : (settingsData.default_paid_leave_monthly ?? 1),
              paidLeavesUsed:        bal != null ? (bal.paid_leaves_used        ?? 0) : 0,
              paidLeavesRemaining:   bal != null ? (bal.paid_leaves_remaining   ?? 0) : 0,
              // Grace: always use stored DB value — DB is authoritative (synced from settings on save)
              graceTotal:     bal != null ? (bal.grace_leaves_total     ?? 0) : 0,
              graceUsed:      bal != null ? (bal.grace_leaves_used      ?? 0) : 0,
              graceRemaining: bal != null ? (bal.grace_leaves_remaining ?? 0) : 0,
              // Settings-based monthly allotments kept for reference (used by auto-credit logic)
              elMonthly: settingsData.default_earned_leave_monthly ?? 0,
              plMonthly: settingsData.default_paid_leave_monthly ?? 1.0,
              graceMonthlyLimit: bal != null ? (bal.grace_leaves_total ?? 0) : 0,
            }
          })

          const ruledData = applyAttendanceRules(enrichedData, settingsData, selectedYear, selectedMonth)
          console.log('Formatted data:', ruledData)

          // ⚡ Attendance-specific permission filtering
          // Must be independent of employees module permissions
          // e.g. having employees:view_team does NOT grant attendance:view_team
          const attendanceViewAll = canUserViewAll();
          const attendanceViewJunior = canUserViewJunior();
          let finalData = ruledData;
          if (!attendanceViewAll && !attendanceViewJunior) {
            // User only has 'own' attendance permission — show only their own record
            // Compare using mongoId (MongoDB _id) since emp.id may be a custom employee_id (e.g. RM001)
            finalData = finalData.filter(emp => emp.mongoId === user.user_id || emp.id === user.user_id);
          }
          setAttendanceData(finalData)

          // Batch-fetch warning penalties for all employees (background — non-blocking)
          try {
            const mongoIds = ruledData.map(r => r.mongoId).filter(Boolean)
            if (mongoIds.length > 0) {
              const penaltiesResp = await axios.get(
                `${BASE_URL}/warnings/penalties/batch`,
                {
                  params: {
                    employee_ids: mongoIds.join(','),
                    month: selectedMonth,
                    year: selectedYear,
                    user_id: user.user_id
                  },
                  headers: getAuthHeaders()
                }
              )
              if (penaltiesResp.data?.success) {
                setWarningPenaltiesMap(penaltiesResp.data.data || {})
              }
            }
          } catch (penErr) {
            console.warn('Could not load warning penalties batch:', penErr)
          }

          // Fetch finance deductions (approved) for this month — background, non-blocking
          try {
            const finResp = await axios.get(
              `${BASE_URL}/hrms/finance-summary`,
              {
                params: { user_id: user.user_id, year: selectedYear, month: selectedMonth - 1 },
                headers: getAuthHeaders()
              }
            )
            const finDeductions = finResp.data?.deductions || []
            // Build map: mongoId (employee_id) → [deduction records]
            const finMap = {}
            finDeductions.forEach(d => {
              const empId = d.employee_id
              if (!empId) return
              if (!finMap[empId]) finMap[empId] = []
              finMap[empId].push(d)
            })
            setFinanceDeductionsMap(finMap)
          } catch (finErr) {
            console.warn('Could not load finance deductions:', finErr)
          }

          // Load real edit counts from DB so they survive hard refresh
          try {
            const firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
            const lastDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${new Date(selectedYear, selectedMonth, 0).getDate()}`
            const mongoIds = ruledData.map(r => r.mongoId).filter(Boolean)
            if (mongoIds.length > 0) {
              const countsResp = await attendanceAPI.getEditCounts(mongoIds, firstDay, lastDay, user.user_id)
              if (countsResp?.counts && Object.keys(countsResp.counts).length > 0) {
                // Build mongoId → empId map
                const mongoToEmpId = {}
                ruledData.forEach(r => { if (r.mongoId) mongoToEmpId[r.mongoId] = r.id })
                const newCounts = {}
                Object.entries(countsResp.counts).forEach(([mongoId, count]) => {
                  const empId = mongoToEmpId[mongoId]
                  if (empId && count > 0) newCounts[empId] = count
                })
                setEditCounts(newCounts)
              }
            }
          } catch (countErr) {
            console.warn('Could not load edit counts from DB:', countErr)
          }
        } else {
          setAttendanceData([])
        }

        // Fetch leave data for the month
        try {
          const firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
          const lastDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${new Date(selectedYear, selectedMonth, 0).getDate()}`
          
          const leavesResponse = await fetch(`/api/leaves/?user_id=${user.user_id}&from_date=${firstDay}&to_date=${lastDay}&per_page=100`, {
            headers: getAuthHeaders()
          })
          
          if (leavesResponse.ok) {
            const leavesData = await leavesResponse.json()
            // API returns { leaves: [...], total, page, ... } or plain array
            const leavesArray = Array.isArray(leavesData) ? leavesData : (leavesData.leaves || [])
            setMonthlyLeaves(leavesArray)
            
            // Create a map of employee_id -> date -> leave_status
            const map = new Map()
            if (Array.isArray(leavesArray)) {
              leavesArray.forEach(leave => {
                const employeeId = leave.employee_id
                const fromDate = new Date(leave.from_date)
                const toDate = new Date(leave.to_date)
                
                // Iterate through all dates in the leave range
                for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
                  const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  const mapKey = `${employeeId}_${dateKey}`
                  map.set(mapKey, leave.status) // 'pending', 'approved', 'rejected'
                }
              })
            }
            setLeavesMap(map)
            console.log('Leave map created:', map.size, 'entries')
          }
        } catch (leaveError) {
          console.warn('Could not fetch leave data:', leaveError)
          setMonthlyLeaves([])
          setLeavesMap(new Map())
        }
      } catch (error) {
        console.error('Error fetching attendance data:', error)
        setError('Failed to load attendance data. Please try again.')
        setAttendanceData([])
      } finally {
        setLoading(false)
      }
  }, [selectedYear, selectedMonth, user])

  // ── Refresh only leave balances (called when Leave Management tab updates PL/EL/Grace) ──
  // period param: 'YYYY-MM' string from PaidLeaveManagement — may differ from current selectedMonth/Year
  // if changed period matches current view: update in-place; otherwise switch to that month first.
  const refreshLeaveBalances = useCallback(async (changedPeriod) => {
    if (!user?.user_id) return

    // If the changed period is different from current view — switch attendance page to that month
    const targetPeriod = changedPeriod || `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
    const [tYear, tMonth] = targetPeriod.split('-').map(Number)

    if (tYear !== selectedYear || tMonth !== selectedMonth) {
      // Switch attendance view to the changed month — fetchAttendanceData will re-run automatically
      setSelectedYear(tYear)
      setSelectedMonth(tMonth)
      return  // fetchAttendanceData will fetch fresh data including new leave balances
    }

    if (attendanceData.length === 0) return

    // Same period as current view — fast refresh of only leave columns
    const leavePeriod = targetPeriod
    try {
      const results = await Promise.allSettled(
        attendanceData.map(record =>
          axios.get(`${BASE_URL}/settings/leave-balance/${record.mongoId || record.id}`, {
            params: { user_id: user.user_id, period: leavePeriod },
            headers: getAuthHeaders()
          }).then(res => ({ id: record.id, bal: res.data?.data || null }))
        )
      )
      const balMap = {}
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value?.bal && typeof r.value.bal === 'object' && Object.keys(r.value.bal).length > 0) {
          balMap[r.value.id] = r.value.bal
        }
      })
      setAttendanceData(prev => prev.map(record => {
        const bal = balMap[record.id] ?? null
        if (!bal) return record
        return {
          ...record,
          earnedLeavesTotal:     bal.earned_leaves_total     != null ? bal.earned_leaves_total     : record.earnedLeavesTotal,
          earnedLeavesUsed:      bal.earned_leaves_used      != null ? bal.earned_leaves_used      : record.earnedLeavesUsed,
          earnedLeavesRemaining: bal.earned_leaves_remaining != null ? bal.earned_leaves_remaining : record.earnedLeavesRemaining,
          paidLeavesTotal:       bal.paid_leaves_total       != null ? bal.paid_leaves_total       : record.paidLeavesTotal,
          paidLeavesUsed:        bal.paid_leaves_used        != null ? bal.paid_leaves_used        : record.paidLeavesUsed,
          paidLeavesRemaining:   bal.paid_leaves_remaining   != null ? bal.paid_leaves_remaining   : record.paidLeavesRemaining,
          graceTotal:     bal.grace_leaves_total     != null ? bal.grace_leaves_total     : record.graceTotal,
          graceUsed:      bal.grace_leaves_used      != null ? bal.grace_leaves_used      : record.graceUsed,
          graceRemaining: bal.grace_leaves_remaining != null ? bal.grace_leaves_remaining : record.graceRemaining,
          graceMonthlyLimit: bal.grace_leaves_total  != null ? bal.grace_leaves_total     : record.graceMonthlyLimit,
        }
      }))
    } catch (e) {
      console.warn('[AttendancePage] refreshLeaveBalances error:', e)
    }
  }, [selectedYear, selectedMonth, user, attendanceData])

  useEffect(() => {
    fetchAttendanceData()
  }, [fetchAttendanceData])

  // ── When switching BACK to attendance tab from leave tab: refresh PL/EL/Grace columns ──
  // This ensures any changes made in Leave Management tab are immediately reflected.
  const prevPageTabRef = useRef(pageTab)
  useEffect(() => {
    if (prevPageTabRef.current === 'leave' && pageTab === 'attendance') {
      refreshLeaveBalances()
    }
    prevPageTabRef.current = pageTab
  }, [pageTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
  
  // Calculate visible days (hide future dates in current month)
  const getVisibleDays = () => {
    const ist = getISTToday()
    const currentYear = ist.year
    const currentMonth = ist.month
    const currentDay = ist.day
    
    // If viewing current month, only show up to current day
    if (selectedYear === currentYear && selectedMonth === currentMonth) {
      return currentDay
    }
    // If viewing past months or future months, show all days
    return daysInMonth
  }
  
  const visibleDays = getVisibleDays()

  const navigateMonth = (direction) => {
    if (direction === "prev") {
      if (selectedMonth === 1) {
        setSelectedMonth(12)
        setSelectedYear(selectedYear - 1)
      } else {
        setSelectedMonth(selectedMonth - 1)
      }
    } else {
      if (selectedMonth === 12) {
        setSelectedMonth(1)
        setSelectedYear(selectedYear + 1)
      } else {
        setSelectedMonth(selectedMonth + 1)
      }
    }
  }

  const handleEmployeeClick = (employee) => {
    setSelectedEmployee({ ...employee, name: getDisplayEmployeeName(employee) })
    setSelectedDate(1) // Default to first day
    setModalOpen(true)
  }

  const handleDayClick = async (employee, day) => {
    if (!user?.user_id) return
    
    // Block editing for future dates
    const clickedDate = new Date(selectedYear, selectedMonth - 1, day)
    const ist = getISTToday()
    const todayIST = new Date(ist.year, ist.month - 1, ist.day)
    todayIST.setHours(0, 0, 0, 0)
    if (clickedDate > todayIST) {
      return
    }
    
    setSelectedEmployee(employee)
    setSelectedDate(day)
    setModalOpen(true)
    setModalLoading(true)
    
    // Fetch detailed attendance data for this day
    try {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      
      // Fetch attendance detail — use mongoId (MongoDB _id) so backend can find the record
      const detailData = await attendanceAPI.getAttendanceDetail(employee.mongoId || employee.id, dateStr, user.user_id)
      
      // Fetch comments
      try {
        const commentsData = await attendanceAPI.getComments(employee.id, dateStr, user.user_id)
        setComments(commentsData.comments || [])
      } catch (error) {
        console.error('Error fetching comments:', error)
        setComments([])
      }
      
      // Fetch history
      try {
        const historyData = await attendanceAPI.getHistory(employee.mongoId || employee.id, dateStr, user.user_id)
        setHistory(historyData.history || [])
      } catch (error) {
        console.error('Error fetching history:', error)
        setHistory([])
      }
      
      // Store detail data in employee object for modal display
      setSelectedEmployee({
        ...employee,
        name: getDisplayEmployeeName(employee),
        attendanceDetail: detailData
      })
    } catch (error) {
      console.error('Error fetching attendance detail:', error)
    }
    
    setModalLoading(false)
    setSelectedDate(day)
    setModalOpen(true)
  }

  const handleSalaryClick = async (employee, stats, calculatedSalary) => {
    // Use pre-fetched cached penalties (populated when page loaded), or empty if not yet available
    const cachedPenalties = (warningPenaltiesMap[employee.mongoId] || {}).penalties || []
    // Set modal data immediately using cached data
    setSelectedSalaryData({
      employee,
      stats,
      calculatedSalary,
      monthlySalary: employee.salary || 0,
      perDaySalary: (employee.salary || 0) / daysInMonth,
      selectedYear,
      selectedMonth,
      daysInMonth,
      warningPenalties: cachedPenalties
    })
    setSalaryModalOpen(true)

    // Fetch warning penalties in background to ensure freshest data
    try {
      const empId = employee.mongoId || employee.id
      const userData = getUserData()
      if (empId && userData?.user_id) {
        const resp = await axios.get(
          `${BASE_URL}/warnings/penalties/employee/${empId}?month=${selectedMonth}&year=${selectedYear}&user_id=${userData.user_id}`,
          { headers: getAuthHeaders() }
        )
        if (resp.data?.success) {
          const freshPenalties = resp.data.penalties || []
          // Update modal with fresh data
          setSelectedSalaryData(prev => prev ? {
            ...prev,
            warningPenalties: freshPenalties
          } : prev)
          // Also update the map so the table cell reflects fresh data
          setWarningPenaltiesMap(prev => ({
            ...prev,
            [empId]: { total_penalty: resp.data.total_penalty || 0, penalties: freshPenalties }
          }))
        }
      }
    } catch (err) {
      console.warn('Could not refresh warning penalties for salary:', err)
    }
  }

  const handleDeductionClick = (record, stats, calculatedSalary, attendanceDeduction, warningFine, empFinanceDeds, shortfall, shortfallDeduction, effectiveSalary) => {
    const empPenalties = warningPenaltiesMap[record.mongoId] || {}
    const monthlySalary = record.salary || 0
    setSelectedDeductionData({
      employee: record,
      stats,
      calculatedSalary,
      monthlySalary,
      effectiveSalary: effectiveSalary != null ? effectiveSalary : monthlySalary,
      perDaySalary: monthlySalary / daysInMonth,
      selectedYear,
      selectedMonth,
      daysInMonth,
      warningPenalties: empPenalties.penalties || [],
      attendanceDeduction,
      warningFine,
      financeDeductions: empFinanceDeds || [],
      shortfall,
      shortfallDeduction,
    })
    setDeductionModalOpen(true)
  }

  const handleRevokeWarning = async (warningId, empMongoId) => {
    const userData = getUserData()
    if (!userData?.user_id) return
    try {
      await axios.patch(
        `${BASE_URL}/warnings/${warningId}/waive`,
        {},
        { params: { user_id: userData.user_id }, headers: getAuthHeaders() }
      )
      // Remove the revoked fine from cache
      setWarningPenaltiesMap(prev => {
        const emp = prev[empMongoId] || { total_penalty: 0, penalties: [] }
        const newPenalties = emp.penalties.filter(p => p.id !== warningId)
        const newTotal = newPenalties.reduce((sum, p) => sum + (p.penalty_amount || 0), 0)
        return { ...prev, [empMongoId]: { total_penalty: newTotal, penalties: newPenalties } }
      })
      // Keep open modal in sync
      setSelectedDeductionData(prev => {
        if (!prev) return prev
        const newPenalties = prev.warningPenalties.filter(p => p.id !== warningId)
        return { ...prev, warningPenalties: newPenalties }
      })
    } catch (err) {
      console.error('Failed to revoke warning penalty:', err)
      alert('Failed to revoke warning penalty. Please try again.')
    }
  }

  const handleEditHistoryClick = async (employee) => {
    if (!user?.user_id) return
    
    console.log('📋 [EDIT HISTORY] Opening history for employee:', employee.id, employee.name)
    
    setSelectedEmployeeHistory({ ...employee, name: getDisplayEmployeeName(employee) })
    setModalLoading(true)
    setEditHistoryModalOpen(true)
    
    try {
      // Fetch employee's attendance history for the selected month
      const firstDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const lastDay = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${daysInMonth}`
      
      // Use mongoId (MongoDB _id) for history lookup — history is stored with MongoDB _id, not employee_id
      const historyUserId = employee.mongoId || employee.id
      console.log('📅 [EDIT HISTORY] Fetching history from', firstDay, 'to', lastDay)
      console.log('👤 [EDIT HISTORY] Using history userId:', historyUserId, '(mongoId:', employee.mongoId, ', id:', employee.id, ')')
      
      const historyResponse = await attendanceAPI.getUserHistory(
        historyUserId, 
        user.user_id, 
        firstDay, 
        lastDay, 
        100 // Get up to 100 history entries for the month
      )
      
      console.log('📥 [EDIT HISTORY] Response received:', historyResponse)
      
      if (historyResponse?.history) {
        console.log('✅ [EDIT HISTORY] Found', historyResponse.history.length, 'history entries')
        // Sort by attendance date ascending (1st at top), then edit time ascending
        const sortedHistory = historyResponse.history.sort((a, b) => {
          const dateA = a.date ? new Date(`${a.date}T00:00:00`).getTime() : 0
          const dateB = b.date ? new Date(`${b.date}T00:00:00`).getTime() : 0
          if (dateA !== dateB) return dateA - dateB
          return new Date(a.changed_at || a.timestamp || a.created_at || 0) - new Date(b.changed_at || b.timestamp || b.created_at || 0)
        })
        console.log('📊 [EDIT HISTORY] First entry:', sortedHistory[0])
        setEditHistoryData(sortedHistory)
        // Only update count if history returned entries (never wipe an existing count with 0)
        if (employee?.id && sortedHistory.length > 0) {
          setEditCounts(prev => ({ ...prev, [employee.id]: sortedHistory.length }))
        }
      } else {
        console.log('⚠️ [EDIT HISTORY] No history data in response')
        setEditHistoryData([])
      }
    } catch (error) {
      console.error('❌ [EDIT HISTORY] Error fetching edit history:', error)
      setEditHistoryData([])
    } finally {
      setModalLoading(false)
    }
  }

  const handleUpdateAttendance = (employeeId, day, newStatus) => {
    setAttendanceData((prevData) => {
      // Update the specific day — mark it as manually overridden so rules don't re-override it
      const updated = prevData.map((employee) => {
        if (employee.id !== employeeId) return employee
        const dateObj = new Date(selectedYear, selectedMonth - 1, day)
        const isSunday = dateObj.getDay() === 0
        return {
          ...employee,
          [`day${day}`]: newStatus,
          // Track manually overridden Sundays so applyAttendanceRules skips them
          ...(isSunday ? { [`day${day}_manualOverride`]: true } : {}),
        }
      })
      // Re-apply adjacency/sandwich rules so e.g. Saturday AB → Sunday AB immediately
      return applyAttendanceRules(updated, attendanceSettings, selectedYear, selectedMonth)
    })
    // Increment local session edit count for this employee
    setEditCounts(prev => ({ ...prev, [employeeId]: (prev[employeeId] || 0) + 1 }))
  }

  const handleUpdateHolidays = async (newHolidays) => {
    setHolidays(newHolidays)
    // The holidays are now managed via API calls in the modal
    // This function just updates the local state for immediate UI updates
    console.log('Updated holidays:', newHolidays)
    
    // Optionally refresh attendance data to reflect holiday changes
    if (user?.user_id && (permissions !== null || isAdmin())) {
      try {
        // Fetch ALL employees for status map
        let activeEmployeeIds = null;
        const salaryMap2 = {};
        const empStatusMap2 = {};
        let allHrmsEmps2 = [];
        try {
          const employeesResponse = await hrmsService.getEmployees('all');
          if (employeesResponse?.data) {
            allHrmsEmps2 = employeesResponse.data;
            activeEmployeeIds = new Set();
            employeesResponse.data.forEach(emp => {
              const empId = emp.employee_id || emp._id;
              const isActive = emp.employee_status ? emp.employee_status === 'active' : emp.is_active !== false;
              if (empId) {
                empStatusMap2[empId] = isActive ? 'active' : 'inactive';
                empStatusMap2[String(empId)] = isActive ? 'active' : 'inactive';
                if (isActive) {
                  activeEmployeeIds.add(empId);
                  activeEmployeeIds.add(String(empId));
                  activeEmployeeIds.add(Number(empId));
                }
              }
            });
            // Build salary map
            employeesResponse.data.forEach(emp => {
              const eid = emp.employee_id || emp._id;
              const sal = parseFloat(emp.salary) || 0;
              if (eid && sal > 0) {
                salaryMap2[eid] = sal;
                salaryMap2[String(eid)] = sal;
              }
            });
          }
        } catch (empError) {
          console.warn('⚠️ Could not fetch employee list');
        }

        const response = await attendanceAPI.getCalendar(selectedYear, selectedMonth, user.user_id)
        if (response && response.employees) {
          let formattedData = convertToCalendarFormat(response, activeEmployeeIds, salaryMap2, empStatusMap2, allHrmsEmps2)
          
          // Apply attendance-specific permission filtering (independent of employees module)
          const attViewAll = canUserViewAll();
          const attViewJunior = canUserViewJunior();
          if (!attViewAll && !attViewJunior) {
            // Compare using mongoId (MongoDB _id) since employee.id may be a custom employee_id (e.g. RM001)
            formattedData = formattedData.filter(employee => employee.mongoId === user.user_id || employee.id === user.user_id)
          }
          
          setAttendanceData(formattedData)
        }
      } catch (error) {
        console.error('Error refreshing attendance data after holiday update:', error)
      }
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedEmployee || !selectedDate || !user?.user_id) return
    
    try {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`
      await attendanceAPI.addComment(selectedEmployee.id, dateStr, newComment.trim(), user.user_id)
      
      // Refresh comments
      const commentsData = await attendanceAPI.getComments(selectedEmployee.id, dateStr, user.user_id)
      setComments(commentsData.comments || [])
      setNewComment('')
    } catch (error) {
      console.error('Error adding comment:', error)
      // You might want to show an error message to the user here
    }
  }

  // All unique teams for filter dropdown
  const allTeams = useMemo(
    () => [...new Set(attendanceData.map(r => r.department).filter(Boolean))].sort(),
    [attendanceData]
  )

  // Sort handler for table columns
  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
    }))
  }, [])

  // Compute today's attendance counts for stat strip
  const _istToday = getISTToday()
  const isCurrentMonth = _istToday.year === selectedYear && _istToday.month === selectedMonth
  const todayDay = _istToday.day

  // All aggregate stats — memoized so they don't recompute on every render
  const stripStats = useMemo(() => {
    let statsData = attendanceData
    if (empStatusFilter === 'active') {
      statsData = attendanceData.filter(r => r.isActive !== false)
    } else if (empStatusFilter === 'inactive') {
      statsData = attendanceData.filter(r => r.isActive === false)
    }
    let presentToday = 0, absentToday = 0
    let totalAbsconding = 0, totalLeave = 0, totalGraceUsed = 0, totalAttendancePct = 0
    statsData.forEach(r => {
      if (isCurrentMonth) {
        const s = r[`day${todayDay}`]
        if (['P', 'L', 'SP', 'HD', 'WK'].includes(s)) presentToday++
        else if (['A', 'AB'].includes(s)) absentToday++
      }
      const st = calculateMonthlyStats(r, selectedYear, selectedMonth, daysInMonth, holidays)
      totalAbsconding += st.absconding
      totalLeave += (st.plDays || 0) + (st.elDays || 0)
      totalGraceUsed += Math.max(0, (st.graceTotal || 0) - (st.graceRemaining || 0))
      totalAttendancePct += parseFloat(st.attendancePercentage) || 0
    })
    const avgAttendancePct = statsData.length > 0
      ? (totalAttendancePct / statsData.length).toFixed(1)
      : '0.0'
    return { presentToday, absentToday, totalAbsconding, totalLeave, totalGraceUsed, avgAttendancePct, statsCount: statsData.length }
  }, [attendanceData, selectedYear, selectedMonth, daysInMonth, holidays, isCurrentMonth, todayDay, empStatusFilter])

  const { presentToday, absentToday, totalAbsconding, totalLeave, totalGraceUsed, avgAttendancePct, statsCount } = stripStats

  // Filtered + sorted data for table — memoized
  const filteredData = useMemo(() => {
    let data = [...attendanceData]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      data = data.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        String(r.employeeId || '').toLowerCase().includes(q)
      )
    }
    if (teamFilter) {
      data = data.filter(r => r.department === teamFilter)
    }
    if (empStatusFilter === 'active') {
      data = data.filter(r => r.isActive !== false)
    } else if (empStatusFilter === 'inactive') {
      data = data.filter(r => r.isActive === false)
    }
    if (statusFilter !== 'all' && isCurrentMonth) {
      data = data.filter(r => {
        const s = r[`day${todayDay}`]
        if (statusFilter === 'present') return ['P', 'L', 'SP'].includes(s)
        if (statusFilter === 'absent') return s === 'A'
        if (statusFilter === 'leave') return s === 'LV'
        if (statusFilter === 'absconding') return s === 'AB'
        if (statusFilter === 'halfday') return s === 'HD'
        return true
      })
    }
    if (sortConfig.key) {
      data.sort((a, b) => {
        let av = a[sortConfig.key] ?? ''
        let bv = b[sortConfig.key] ?? ''
        if (typeof av === 'string') av = av.toLowerCase()
        if (typeof bv === 'string') bv = bv.toLowerCase()
        if (av < bv) return sortConfig.dir === 'asc' ? -1 : 1
        if (av > bv) return sortConfig.dir === 'asc' ? 1 : -1
        return 0
      })
    }
    return data
  }, [attendanceData, searchQuery, teamFilter, empStatusFilter, statusFilter, sortConfig, isCurrentMonth, todayDay])

  if (loading || (user && permissions === null && !isAdmin())) {
    return (
      <div className="attendance-page task-page-container">
        <style>{attendancePageStyles}</style>
        <div className="task-loading-spinner">
          <div className="spinner" />
          <p>{permissions === null ? 'Loading permissions...' : 'Loading attendance data...'}</p>
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="attendance-page task-page-container">
        <style>{attendancePageStyles}</style>
        <div className="task-error-state">
          <p>{error}</p>
          <button type="button" className="task-btn-retry" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="attendance-page task-page-container">
      <style>{attendancePageStyles}</style>

      <div className="task-top-bar">
        <div className="task-top-bar-left">
          <h1>Attendance</h1>
          <p>{months[selectedMonth - 1]} {selectedYear} · {statsCount} employee{statsCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="task-top-bar-right">
          <div className="attendance-month-nav">
            <button type="button" className="task-btn-secondary" style={{ padding: '4px 6px' }} onClick={() => navigateMonth('prev')} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="attendance-month-label">
              <Calendar className="h-4 w-4" style={{ color: '#c8d0e0' }} />
              {months[selectedMonth - 1]} {selectedYear}
            </span>
            <button type="button" className="task-btn-secondary" style={{ padding: '4px 6px' }} onClick={() => navigateMonth('next')} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {canViewAllRecords() && (
            <button type="button" className="task-btn-secondary" onClick={() => setHolidayModalOpen(true)}>
              <Calendar className="h-4 w-4" /> Holidays
            </button>
          )}
          <button
            type="button"
            className="task-btn-secondary"
            onClick={() => exportToPDF(attendanceData, selectedYear, selectedMonth, holidays).catch(e => alert('Export failed: ' + e.message))}
          >
            <Download className="h-4 w-4" /> Export Excel
          </button>
        </div>
      </div>

      <div className="task-view-toggle-bar">
        <div className="task-view-toggle-group">
          <button
            type="button"
            className={`task-view-toggle-btn${pageTab === 'attendance' ? ' active' : ''}`}
            onClick={() => setPageTab('attendance')}
          >
            Attendance
          </button>
          {canShowLeaveManagement && (
            <button
              type="button"
              className={`task-view-toggle-btn${pageTab === 'leave' ? ' active' : ''}`}
              onClick={() => setPageTab('leave')}
            >
              Leave Management
            </button>
          )}
        </div>
        {pageTab === 'attendance' && (
          <div className="task-toolbar-right">
            <div className="task-search-box--in-bar">
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setEmpDropdownOpen(true) }}
                placeholder="Search by name or employee ID..."
                onFocus={() => setEmpDropdownOpen(true)}
                onBlur={() => setTimeout(() => setEmpDropdownOpen(false), 160)}
              />
              <span className="search-icon">
                <svg style={{width:'14px',height:'14px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/></svg>
              </span>
              {empDropdownOpen && (() => {
                const q = searchQuery.trim().toLowerCase()
                const empList = attendanceData.filter(r =>
                  !q || r.name?.toLowerCase().includes(q) || String(r.employeeId || '').toLowerCase().includes(q)
                )
                return empList.length > 0 ? (
                  <div className="attendance-filter-menu" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    {empList.map(r => (
                      <div
                        key={r.mongoId || r.id}
                        className="attendance-filter-option"
                        onMouseDown={() => { setSearchQuery(r.name); setEmpDropdownOpen(false) }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        <span style={{color:'#c8d0e0',minWidth:'36px',fontSize:'11px'}}>#{r.employeeId || '—'}</span>
                        <span>{r.name}</span>
                        {r.department && <span style={{marginLeft:'auto',color:'#c8d0e0',fontSize:'11px'}}>{r.department}</span>}
                      </div>
                    ))}
                  </div>
                ) : null
              })()}
            </div>
            <div className="attendance-filter-dropdown">
              <div
                className={`attendance-filter-trigger${teamFilter ? '' : ' placeholder'}${teamDropdownOpen ? ' open' : ''}`}
                onClick={() => { setTeamDropdownOpen(o => !o); setTeamSearchText('') }}
                onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setTimeout(() => setTeamDropdownOpen(false), 160) }}
                tabIndex={0}
              >
                {teamFilter || 'All Teams'}
                <svg className={`attendance-filter-chevron${teamDropdownOpen ? ' open' : ''}`} style={{width:'10px',height:'10px'}} fill="none" stroke="currentColor" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              {teamDropdownOpen && (
                <div className="attendance-filter-menu">
                  <div className="attendance-filter-menu-search">
                    <input
                      autoFocus
                      type="text"
                      value={teamSearchText}
                      onChange={e => setTeamSearchText(e.target.value)}
                      placeholder="Search team..."
                    />
                  </div>
                  <div style={{maxHeight:'200px',overflowY:'auto'}}>
                    {[{label:'All Teams', value:''}, ...allTeams.map(t => ({label:t, value:t}))]
                      .filter(opt => !teamSearchText.trim() || opt.label.toLowerCase().includes(teamSearchText.trim().toLowerCase()))
                      .map(opt => (
                        <div
                          key={opt.value || '__all__'}
                          className={`attendance-filter-option${opt.value === teamFilter ? ' selected' : ''}`}
                          onMouseDown={() => { setTeamFilter(opt.value); setTeamDropdownOpen(false) }}
                        >
                          {opt.label}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
            <div className="attendance-filter-dropdown" style={{ minWidth: '150px' }}>
              <div
                className={`attendance-filter-trigger${empStatusFilter !== 'all' ? '' : ' placeholder'}${empStatusDropdownOpen ? ' open' : ''}`}
                onClick={() => setEmpStatusDropdownOpen(o => !o)}
                onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setTimeout(() => setEmpStatusDropdownOpen(false), 160) }}
                tabIndex={0}
              >
                {empStatusFilter === 'all' ? 'All Employees' : empStatusFilter === 'active' ? 'Active Only' : 'Inactive Only'}
                <svg className={`attendance-filter-chevron${empStatusDropdownOpen ? ' open' : ''}`} style={{width:'10px',height:'10px'}} fill="none" stroke="currentColor" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              {empStatusDropdownOpen && (
                <div className="attendance-filter-menu">
                  <div style={{maxHeight:'200px',overflowY:'auto'}}>
                    {[{label:'All Employees', value:'all'}, {label:'Active Only', value:'active'}, {label:'Inactive Only', value:'inactive'}]
                      .map(opt => (
                        <div
                          key={opt.value}
                          className={`attendance-filter-option${opt.value === empStatusFilter ? ' selected' : ''}`}
                          onMouseDown={() => { setEmpStatusFilter(opt.value); setEmpStatusDropdownOpen(false) }}
                        >
                          {opt.label}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
            <div className="attendance-filter-meta">
              {filteredData.length} / {attendanceData.length}
            </div>
          </div>
        )}
      </div>

      {pageTab === 'leave' && (
        <div className="attendance-page-content">
          <PaidLeaveManagement selectedYear={selectedYear} selectedMonth={selectedMonth} onLeaveUpdate={refreshLeaveBalances} />
        </div>
      )}

      {pageTab === 'attendance' && <>
      <div className="attendance-page-content">
      {/* Legend */}
      <div className="attendance-legend">
        <div className="attendance-legend-item">
          <span style={{width:'32px',height:'20px',display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:'12px',backgroundColor:'#10b981',color:'#000',fontWeight:700,fontSize:'11px'}}>1</span>
          <span className="attendance-legend-label">Full Day</span>
        </div>
        <div className="attendance-legend-item">
          <span style={{width:'32px',height:'20px',display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:'12px',backgroundColor:'#ffdd00',color:'#000',fontWeight:700,fontSize:'11px'}}>0.5</span>
          <span className="attendance-legend-label">Half Day</span>
        </div>
        <div className="attendance-legend-item">
          <span style={{width:'32px',height:'20px',display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:'12px',backgroundColor:'#ffffff',color:'#000',fontWeight:700,fontSize:'11px'}}>0</span>
          <span className="attendance-legend-label">Absent</span>
        </div>
        <div className="attendance-legend-item">
          <span style={{width:'32px',height:'20px',display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:'12px',backgroundColor:'#ff7b00',color:'#000',fontWeight:700,fontSize:'11px'}}>0</span>
          <span className="attendance-legend-label">Leave</span>
        </div>
        <div className="attendance-legend-item">
          <span style={{width:'32px',height:'20px',display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:'12px',backgroundColor:'#ff2a2a',color:'#fff',fontWeight:700,fontSize:'11px'}}>-1</span>
          <span className="attendance-legend-label">Absconding</span>
        </div>
        <div className="attendance-legend-item">
          <span style={{width:'32px',height:'20px',display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:'12px',backgroundColor:'#06b6d4',color:'#000',fontWeight:700,fontSize:'11px'}}>1</span>
          <span className="attendance-legend-label">Holiday</span>
        </div>
        <div className="attendance-legend-item">
          <span className="animate-pulse" style={{width:'32px',height:'20px',display:'inline-flex',alignItems:'center',justifyContent:'center',borderRadius:'12px',backgroundColor:'#3b82f6',color:'#fff',fontWeight:700,fontSize:'11px'}}>IN</span>
          <span className="attendance-legend-label">Punched In</span>
        </div>
      </div>

      {/* Dashboard Stat Strip */}
      <div className="attendance-kpi-row">
        <div className="attendance-kpi">
          <div className="attendance-kpi-label">Employees</div>
          <div className="attendance-kpi-val" style={{color:'#93c5fd'}}>{statsCount}</div>
          <div className="attendance-kpi-sub">{months[selectedMonth-1]} {selectedYear}</div>
        </div>
        <div className="attendance-kpi">
          <div className="attendance-kpi-label">Attendance</div>
          <div className="attendance-kpi-val" style={{color:'#34d399'}}>{avgAttendancePct}%</div>
          <div className="attendance-kpi-sub">monthly average</div>
          <div className="attendance-kpi-bar"><div className="attendance-kpi-bar-fill" style={{background:'#34d399',width:`${Math.min(100,parseFloat(avgAttendancePct))}%`}} /></div>
        </div>
        <div className="attendance-kpi">
          <div className="attendance-kpi-label">Present Today</div>
          <div className="attendance-kpi-val" style={{color:'#34d399',display:'flex',alignItems:'center',gap:'6px'}}>
            {isCurrentMonth ? presentToday : '—'}
            {isCurrentMonth && <span style={{fontSize:'11px',color:'#3b82f6',display:'inline-flex',alignItems:'center',gap:'3px'}}><span className="animate-pulse" style={{width:'6px',height:'6px',borderRadius:'50%',background:'#3b82f6',display:'inline-block'}} />IN</span>}
          </div>
          <div className="attendance-kpi-sub">out of {statsCount} employees</div>
          <div className="attendance-kpi-bar"><div className="attendance-kpi-bar-fill" style={{background:'#34d399',width:`${statsCount>0&&isCurrentMonth?Math.min(100,(presentToday/statsCount)*100):0}%`}} /></div>
        </div>
        <div className="attendance-kpi">
          <div className="attendance-kpi-label">Absent Today</div>
          <div className="attendance-kpi-val" style={{color:'#c8d0e0'}}>{isCurrentMonth ? absentToday : '—'}</div>
          <div className="attendance-kpi-sub">no check-in recorded</div>
          <div className="attendance-kpi-bar"><div className="attendance-kpi-bar-fill" style={{background:'#6b7a99',width:`${statsCount>0&&isCurrentMonth?Math.min(100,(absentToday/statsCount)*100):0}%`}} /></div>
        </div>
        <div className="attendance-kpi">
          <div className="attendance-kpi-label">Leave Taken</div>
          <div className="attendance-kpi-val" style={{color:'#fb923c'}}>{totalLeave}</div>
          <div className="attendance-kpi-sub">days this month</div>
          <div className="attendance-kpi-bar"><div className="attendance-kpi-bar-fill" style={{background:'#fb923c',width:`${statsCount>0?Math.min(100,(totalLeave/statsCount)*100):0}%`}} /></div>
        </div>
        <div className="attendance-kpi">
          <div className="attendance-kpi-label">Absconding</div>
          <div className="attendance-kpi-val" style={{color:'#f87171'}}>{totalAbsconding}</div>
          <div className="attendance-kpi-sub">instances this month</div>
          <div className="attendance-kpi-bar"><div className="attendance-kpi-bar-fill" style={{background:'#f87171',width:`${statsCount>0?Math.min(100,(totalAbsconding/statsCount)*100):0}%`}} /></div>
        </div>
        <div className="attendance-kpi">
          <div className="attendance-kpi-label">Grace Used</div>
          <div className="attendance-kpi-val" style={{color:'#22d3ee'}}>{totalGraceUsed}</div>
          <div className="attendance-kpi-sub">mins consumed</div>
          <div className="attendance-kpi-bar"><div className="attendance-kpi-bar-fill" style={{background:'#22d3ee',width:'20%'}} /></div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="attendance-table-shell">
        <div className="attendance-table-scroll-bar">
          <button
            type="button"
            className="attendance-table-scroll-btn"
            onClick={() => scrollTable('left')}
            disabled={!canScrollLeft}
            aria-label="Scroll left"
          >
            <ChevronLeft style={{width:'12px',height:'12px'}} />
          </button>
          <button
            type="button"
            className="attendance-table-scroll-btn"
            onClick={() => scrollTable('right')}
            disabled={!canScrollRight}
            aria-label="Scroll right"
          >
            <ChevronRight style={{width:'12px',height:'12px'}} />
          </button>
        </div>
        <div style={{position:'relative'}}>
          <div
            ref={tableScrollRef}
            style={{overflowX:'auto',scrollbarWidth:'none',msOverflowStyle:'none'}}
            onScroll={updateScrollButtons}
          >
            <table style={{minWidth:'1200px',width:'100%',backgroundColor:'#000',borderCollapse:'separate',borderSpacing:'0',fontSize:'11px',whiteSpace:'nowrap'}}>
            <thead>
              {/* Row 1: main headers */}
              <tr>
                <th colSpan={3} className="sticky left-0 z-[4] attendance-table-head-group" style={{padding:'5px 8px',textAlign:'center',fontSize:'12px',borderRight:'2px solid #e5e7eb'}}>
                  Employee Details
                </th>
                {Array.from({ length: visibleDays }, (_, i) => i + 1).map((day) => {
                  const dayName = getDayName(selectedYear, selectedMonth, day)
                  const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isHoliday = holidays.some(h => h.date === dateStr)
                  const isSunday = dayName === 'Sun'
                  
                  // Leads-style header: white background + cyan text
                  const headerBg = '#ffffff'
                  const headerColor = '#03b0f5'
                  
                  return (
                    <th
                      key={day}
                      rowSpan={2}
                      className="attendance-table-head-day"
                      style={{
                        backgroundColor: headerBg,
                        color: headerColor,
                        padding: '6px 4px',
                        minWidth: '34px',
                        border: '1px solid #e5e7eb',
                        fontWeight: 800,
                        textAlign: 'center',
                        verticalAlign: 'middle',
                      }}
                    >
                      <div style={{fontSize:'13px',fontWeight:800,marginBottom:'2px'}}>{day}</div>
                      <div style={{fontSize:'10px',fontWeight:800,textTransform:'uppercase'}}>{dayName}</div>
                      {isSunday && !isHoliday && <div style={{fontSize:'9px',opacity:0.9}}>☀</div>}
                      {isHoliday && <div style={{fontSize:'10px'}}>🎉</div>}
                    </th>
                  )
                })}
                <th colSpan={canViewSalary ? 12 : 10} className="attendance-table-head-group" style={{padding:'5px 8px',textAlign:'center',fontSize:'12px'}}>
                  Summary
                </th>
              </tr>
              {/* Row 2: sub-columns for Employee Details + Summary */}
              <tr style={{backgroundColor:'#ffffff'}}>
                <th className="cursor-pointer select-none attendance-table-head-col sortable" style={{position:'sticky',left:0,zIndex:3,padding:'5px 8px',textAlign:'left',minWidth:'90px',width:'90px',boxSizing:'border-box'}} onClick={() => handleSort('employeeId')}>
                  <span style={{display:'flex',alignItems:'center',gap:'4px'}}>Emp ID <span style={{opacity:sortConfig.key==='employeeId'?1:0.4}}>{sortConfig.key==='employeeId'?(sortConfig.dir==='asc'?'↑':'↓'):'⇅'}</span></span>
                </th>
                <th className="cursor-pointer select-none attendance-table-head-col sortable" style={{position:'sticky',left:'90px',zIndex:3,padding:'5px 8px',textAlign:'left',minWidth:'150px',width:'150px',boxSizing:'border-box'}} onClick={() => handleSort('name')}>
                  <span style={{display:'flex',alignItems:'center',gap:'4px'}}>Name <span style={{opacity:sortConfig.key==='name'?1:0.4}}>{sortConfig.key==='name'?(sortConfig.dir==='asc'?'↑':'↓'):'⇅'}</span></span>
                </th>
                <th className="cursor-pointer select-none attendance-table-head-col sortable" style={{position:'sticky',left:'240px',zIndex:3,padding:'5px 8px',textAlign:'left',borderRight:'2px solid #e5e7eb',minWidth:'130px',width:'130px',boxSizing:'border-box',boxShadow:'3px 0 8px rgba(0,0,0,0.08)'}} onClick={() => handleSort('department')}>
                  <span style={{display:'flex',alignItems:'center',gap:'4px'}}>Team <span style={{opacity:sortConfig.key==='department'?1:0.4}}>{sortConfig.key==='department'?(sortConfig.dir==='asc'?'↑':'↓'):'⇅'}</span></span>
                </th>
                <th className="attendance-table-head-col" style={{minWidth:'50px',padding:'6px'}}>Edit</th>
                <th className="attendance-table-head-col" style={{minWidth:'60px',padding:'6px'}}>Present</th>
                <th className="attendance-table-head-col" style={{minWidth:'60px',padding:'6px'}}>Grace</th>
                <th className="attendance-table-head-col" style={{minWidth:'50px',padding:'6px'}}>PL</th>
                <th className="attendance-table-head-col" style={{minWidth:'50px',padding:'6px'}}>EL</th>
                <th className="attendance-table-head-col" style={{minWidth:'60px',padding:'6px'}}>Final</th>
                    {canViewSalary && <th className="attendance-table-head-col" style={{minWidth:'75px',padding:'6px'}}>Salary</th>}
                    <th className="attendance-table-head-col" style={{minWidth:'90px',padding:'6px'}}>Monthly Target</th>
                    <th className="attendance-table-head-col" style={{minWidth:'90px',padding:'6px'}}>Individual Target</th>
                    <th className="attendance-table-head-col" style={{minWidth:'90px',padding:'6px'}}>Final Business</th>
                    <th className="attendance-table-head-col" style={{minWidth:'80px',padding:'6px'}}>Shortfall</th>
                    {canViewSalary && <th className="attendance-table-head-col" style={{minWidth:'75px',padding:'6px'}}>Deduction</th>}
              </tr>
            </thead>
            <tbody className="bg-black">
              {filteredData.map((record, index) => {
                const stats = calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays)
                const isEvenRow = index % 2 === 0
                const joiningDateKey = normalizeDateKey(record.joining_date || record.date_of_joining)
                const inactiveDateKey = record.isActive === false ? normalizeDateKey(record.inactive_from_date) : null
                
                // Calculate salary
                const monthlySalary = record.salary || 0
                const perDaySalary = monthlySalary / daysInMonth

                // Effective days: if employee joined mid-month, count only from joining day
                let effectiveDays = daysInMonth
                if (joiningDateKey) {
                  const jYear  = parseInt(joiningDateKey.substring(0, 4), 10)
                  const jMonth = parseInt(joiningDateKey.substring(5, 7), 10) // 1-based
                  const jDay   = parseInt(joiningDateKey.substring(8, 10), 10)
                  if (jYear === selectedYear && jMonth === selectedMonth) {
                    effectiveDays = daysInMonth - jDay + 1
                  }
                }
                const effectiveSalary = Math.round(perDaySalary * effectiveDays)
                // calculatedSalary = salary earned = finalScore × perDay
                // finalScore already includes PL days (presentScore + plDays)
                const earnedDays = Math.min(Math.max(0, stats.finalScore), effectiveDays)
                const calculatedSalary = Math.round(perDaySalary * earnedDays)

                // 1. Attendance deduction = effective salary - earned salary
                // (not full monthlySalary — pre-joining days don't count as absent)
                const attendanceDeduction = Math.max(0, effectiveSalary - calculatedSalary)

                // 2. Warning fines
                const empPenalties = warningPenaltiesMap[record.mongoId] || {}
                const warningFine = empPenalties.total_penalty || 0

                // 3. Finance deductions (approved, this month — from Finance page)
                const empFinanceDeds = financeDeductionsMap[record.mongoId] || []
                const financeDedTotal = empFinanceDeds.reduce((s, d) => s + (Number(d.amount) || 0), 0)

                // 4. Shortfall — carries forward to next month (NOT deducted from current salary)
                // Carry forward is handled in SalaryManagement when month is "marked done"
                const shortfall = record.monthlyTarget > 0
                  ? Math.max(0, record.monthlyTarget - (record.settledTarget || 0))
                  : 0
                const shortfallDeduction = 0  // No salary cut — shortfall carries forward via SalaryManagement

                // Total deduction = attendance + warning fines + finance deductions only
                const totalDeduction = Math.round(attendanceDeduction + warningFine + financeDedTotal)
                const netSalary = Math.max(0, effectiveSalary - totalDeduction)
                
                return (
                  <tr
                    key={record.id}
                    className="hover:bg-[#13131c] transition-colors"
                    style={{borderBottom:'1px solid #1f1f27'}}
                  >
                    <td className="sticky left-0 z-[2] cursor-pointer" style={{backgroundColor:'#000',padding:'6px 12px',border:'1px solid #1f1f27',color:'#ffffff',fontWeight:700,fontSize:'11px',minWidth:'90px',width:'90px',boxSizing:'border-box',boxShadow:'2px 0 0 0 #2a2a3a'}} onClick={() => handleEmployeeClick(record)}>
                      {record.employeeId}
                    </td>
                    <td className="sticky z-[2] cursor-pointer" style={{left:'90px',backgroundColor:'#000',padding:'6px 12px',border:'1px solid #1f1f27',color:'#ffffff',fontWeight:700,fontSize:'11px',letterSpacing:'0.2px',minWidth:'150px',width:'150px',boxSizing:'border-box'}} onClick={() => handleEmployeeClick(record)}>
                      {record.name}
                    </td>
                    <td className="sticky z-[2]" style={{left:'240px',backgroundColor:'#000',padding:'6px 12px',border:'1px solid #1f1f27',borderRight:'2px solid #2a2a3a',color:'#ffffff',fontWeight:600,fontSize:'10px',textTransform:'uppercase',letterSpacing:'0.4px',minWidth:'130px',width:'130px',boxSizing:'border-box',boxShadow:'3px 0 8px rgba(0,0,0,0.8)'}}>
                      {record.department}
                    </td>
                    {Array.from({ length: visibleDays }, (_, i) => i + 1).map((day) => {
                      const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const mapKey = `${record.mongoId || record.id}_${dateKey}`
                      const leaveStatus = leavesMap.get(mapKey) || null
                      const isSundayDay = getDayName(selectedYear, selectedMonth, day) === 'Sun'
                      const isHolidayDay = holidays.some(h => h.date === dateKey)
                      const isBeforeJoining = joiningDateKey && dateKey < joiningDateKey
                      // Black out days AFTER the employee became inactive (like pre-joining blackout)
                      const isAfterInactive = inactiveDateKey && dateKey > inactiveDateKey
                      const isBlackedOut = isBeforeJoining || isAfterInactive
                      
                      // Holiday takes priority over Sunday for background colour
                      // Sunday → solid purple, Holiday (incl. Sunday holiday) → cyan tint, Normal → black
                      const cellBg = isBlackedOut ? '#000000' : (isHolidayDay ? 'rgba(6,182,212,0.12)' : isSundayDay ? '#2e1065' : '#000000')
                      const cellBorder = isBlackedOut ? '1px solid #111' : (isHolidayDay ? '1px solid #06b6d4' : isSundayDay ? '1px solid #5b21b6' : '1px solid #1f1f22')

                      // Compute todayKey fresh each render — avoids ANY stale-closure/hook issues
                      const _ist = getISTToday()
                      const todayKey = `${_ist.year}-${String(_ist.month).padStart(2,'0')}-${String(_ist.day).padStart(2,'0')}`

                      // Rule: blank cell on today or any past working date → show Absent ("0")
                      // Sundays, holidays, blacked-out cells, and cells with an existing leave status are untouched.
                      let cellStatus = record[`day${day}`]
                      if (!cellStatus && !isBlackedOut && !isSundayDay && !isHolidayDay && !leaveStatus && dateKey <= todayKey) {
                        cellStatus = 'A'
                      }

                      return (
                        <td
                          key={day}
                          style={{textAlign:'center',cursor:isBlackedOut ? 'default' : 'pointer',border:cellBorder,padding:'4px 2px',backgroundColor:cellBg,verticalAlign:'middle',transition:'background 0.15s'}}
                          onClick={() => !isBlackedOut && handleDayClick(record, day)}
                        >
                          {isBlackedOut ? null : getStatusBadge(cellStatus, leaveStatus)}
                        </td>
                      )
                    })}
                    <td className="px-2 py-1 text-center cursor-pointer hover:bg-gray-700 transition-colors" style={{border:'1px solid #1f1f27'}} onClick={() => handleEditHistoryClick(record)}>
                      <span style={{width:'20px',height:'20px',background:'#ffdd00',color:'#000',borderRadius:'50%',fontSize:'10px',fontWeight:700,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
                        {editCounts[record.id] || 0}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-center text-sm" style={{border:'1px solid #1f1f27',color:'#ffffff',fontWeight:700}}>{Math.max(0, stats.actualPresent)}</td>
                    <td className="px-2 py-1 text-center text-sm" style={{border:'1px solid #1f1f27',color:'#ffffff',fontWeight:700}}>{stats.graceRemaining}/{stats.graceTotal}</td>
                    <td className="px-2 py-1 text-center text-sm" style={{border:'1px solid #1f1f27',color:'#ffffff',fontWeight:700}}>{stats.plDays}</td>
                    <td className="px-2 py-1 text-center text-sm" style={{border:'1px solid #1f1f27',color:'#ffffff',fontWeight:700}}>{stats.elDays}</td>
                    <td className="px-2 py-1 text-center text-sm" style={{border:'1px solid #1f1f27',color:'#ffffff',fontWeight:700}}>{stats.finalScore}</td>
                    {/* Salary column (moved before target columns) */}
                    {canViewSalary && (
                      <td
                        className="px-2 py-1 text-center text-sm cursor-pointer hover:bg-gray-700 transition-colors"
                        style={{border:'1px solid #1f1f27',color:'#ffffff',fontWeight:700}}
                        onClick={() => handleSalaryClick(record, stats, calculatedSalary)}
                      >
                        ₹{netSalary.toLocaleString('en-IN')}
                        {totalDeduction > 0 && <span style={{display:'block',fontSize:'9px',color:'#fca5a5',fontWeight:600}}>net pay</span>}
                      </td>
                    )}
                    {/* Monthly Target */}
                    <td className="px-2 py-1 text-center text-sm" style={{border:'1px solid #1f1f27',color:'#ffffff',fontWeight:700}}>
                      {record.monthlyTarget > 0 ? `₹${record.monthlyTarget.toLocaleString('en-IN')}` : '—'}
                    </td>
                    {/* Individual Target (settled_target — per-employee assigned target, manually editable) */}
                    <td className="px-2 py-1 text-center text-sm" style={{border:'1px solid #1f1f27',color:'#ffffff',fontWeight:700,minWidth:'110px'}}>
                      {editingIndividualTarget === record.id ? (
                        <div style={{display:'flex',alignItems:'center',gap:'4px',justifyContent:'center'}}>
                          <span style={{color:'#c8d0e0',fontSize:'11px'}}>₹</span>
                          <CurrencyInput
                            value={individualTargetValue}
                            onChange={e => setIndividualTargetValue(e.target.value)}
                            onKeyDown={e => handleIndividualTargetKeyDown(e, record)}
                            autoFocus
                            style={{
                              width:'90px',
                              background:'#1a1a24',
                              border:'1px solid #3b82f6',
                              borderRadius:'3px',
                              color:'#fff',
                              fontSize:'11px',
                              fontWeight:700,
                              padding:'2px 4px',
                              outline:'none',
                              textAlign:'right'
                            }}
                          />
                          {/* Save */}
                          <button
                            onClick={() => handleIndividualTargetSave(record)}
                            disabled={individualTargetSaving === record.id}
                            title="Save (Enter)"
                            style={{background:'none',border:'none',cursor:'pointer',padding:'2px',color:'#10b981',display:'flex',alignItems:'center'}}
                          >
                            {individualTargetSaving === record.id
                              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{animation:'attendanceSpin 0.7s linear infinite'}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            }
                          </button>
                          {/* Cancel */}
                          <button
                            onClick={() => setEditingIndividualTarget(null)}
                            title="Cancel (Esc)"
                            style={{background:'none',border:'none',cursor:'pointer',padding:'2px',color:'#ef4444',display:'flex',alignItems:'center'}}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ) : (
                        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'5px'}}>
                          <span>{record.settledTarget > 0 ? `₹${record.settledTarget.toLocaleString('en-IN')}` : '—'}</span>
                          <button
                            onClick={e => { e.stopPropagation(); handleIndividualTargetEdit(record); }}
                            title="Edit individual target"
                            style={{background:'none',border:'none',cursor:'pointer',padding:'2px',color:'#c8d0e0',display:'flex',alignItems:'center',opacity:0.7,transition:'opacity 0.15s'}}
                            onMouseEnter={e => e.currentTarget.style.opacity='1'}
                            onMouseLeave={e => e.currentTarget.style.opacity='0.7'}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                        </div>
                      )}
                    </td>
                    {/* Final Business (actual business done = settledTarget in HRMS) */}
                    <td className="px-2 py-1 text-center text-sm" style={{border:'1px solid #1f1f27',color: record.settledTarget >= record.monthlyTarget && record.monthlyTarget > 0 ? '#10b981' : record.settledTarget > 0 ? '#fbbf24' : '#ffffff',fontWeight:700}}>
                      {record.settledTarget > 0 ? `₹${record.settledTarget.toLocaleString('en-IN')}` : '—'}
                    </td>
                    {/* Shortfall = max(0, Monthly Target - Final Business) */}
                    {(() => {
                      const shortfall = record.monthlyTarget > 0
                        ? Math.max(0, record.monthlyTarget - record.settledTarget)
                        : 0;
                      return (
                        <td className="px-2 py-1 text-center text-sm" style={{border:'1px solid #1f1f27',color: shortfall > 0 ? '#ef4444' : '#10b981',fontWeight:700}} title={shortfall > 0 ? `₹${shortfall.toLocaleString('en-IN')} will carry forward to next month` : ''}>
                          {record.monthlyTarget > 0
                            ? (shortfall > 0
                                ? <><span>₹{shortfall.toLocaleString('en-IN')}</span><span style={{display:'block',fontSize:'9px',color:'#fb923c',fontWeight:600}}>→ CF</span></>
                                : '✓ Met')
                            : '—'}
                        </td>
                      );
                    })()}
                    {/* Deduction */}
                    {canViewSalary && (
                      <td
                        className="px-2 py-1 text-center text-sm cursor-pointer hover:bg-red-900/20 transition-colors"
                        style={{border:'1px solid #1f1f27',color: totalDeduction > 0 ? '#ef4444' : '#10b981',fontWeight:700}}
                        title={totalDeduction > 0 ? `Total deductions: ₹${totalDeduction.toLocaleString('en-IN')} — click for details` : 'No deductions'}
                        onClick={() => handleDeductionClick(record, stats, calculatedSalary, attendanceDeduction, warningFine, empFinanceDeds, shortfall, shortfallDeduction, effectiveSalary)}
                      >
                        {totalDeduction > 0 ? `−₹${totalDeduction.toLocaleString('en-IN')}` : '✓'}
                        {totalDeduction > 0 && <span style={{display:'block',fontSize:'9px',color:'#fca5a5',fontWeight:600}}>details ↗</span>}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      </div>
      </div>

      {/* Employee Detail Modal */}
      <EmployeeDetailModal
        employee={selectedEmployee}
        selectedDate={selectedDate}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpdate={handleUpdateAttendance}
        canUserEdit={canUserEdit}
        attendanceSettings={attendanceSettings}
      />

      {/* Holiday Management Modal */}
      <HolidayManagementModal
        isOpen={holidayModalOpen}
        onClose={() => setHolidayModalOpen(false)}
        holidays={holidays}
        onUpdateHolidays={handleUpdateHolidays}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
      />

      {/* Salary Detail Modal */}
      <SalaryDetailModal
        isOpen={salaryModalOpen}
        onClose={() => setSalaryModalOpen(false)}
        salaryData={selectedSalaryData}
      />

      {/* Deduction Detail Modal */}
      <DeductionDetailModal
        isOpen={deductionModalOpen}
        onClose={() => setDeductionModalOpen(false)}
        data={selectedDeductionData}
        onRevoke={handleRevokeWarning}
      />

      {/* Edit History Modal */}
      <EditHistoryModal
        isOpen={editHistoryModalOpen}
        onClose={() => setEditHistoryModalOpen(false)}
        employee={selectedEmployeeHistory}
        historyData={editHistoryData}
        loading={modalLoading}
      />
      </> /* end attendance tab */}
    </div>
  )
}
 
