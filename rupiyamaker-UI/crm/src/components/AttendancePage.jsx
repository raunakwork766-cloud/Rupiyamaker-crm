"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronLeft, ChevronRight, Download, Calendar, X, Frown, User, Send, Plus, Trash2, Users2 } from "lucide-react"
import axios from "axios"
import { formatDateTime } from '../utils/dateUtils';
import FaceRegistration from './attendance/FaceRegistration';
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
  debugPermissions 
} from '../utils/permissions';

// API Configuration
const BASE_URL = '/api'

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
          user_id: userId
        },
        headers: getAuthHeaders()
      })
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
        params: { requester_id: requesterId },
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

  deleteHoliday: async (holidayId, userId) => {
    try {
      const response = await axios.delete(`${BASE_URL}/attendance/holidays/${holidayId}`, {
        params: { user_id: userId },
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

const getStatusBadge = (status) => {
  switch (status) {
    case "P":
      return (
        <div className="w-8 h-8 bg-green-500 text-white rounded flex items-center justify-center text-xs font-bold" title="Present">
          P
        </div>
      )
    case "L":
      return (
        <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 text-white rounded flex items-center justify-center text-xs font-bold" title="Late">
          L
        </div>
      )
    case "LV":
      return (
        <div className="w-8 h-8 bg-orange-500 text-white rounded flex items-center justify-center text-xs font-bold" title="Leave Approved">
          LV
        </div>
      )
    case "PL":
      return (
        <div className="w-8 h-8 bg-white text-black border-2 border-gray-400 rounded flex items-center justify-center text-xs font-bold" title="Pending Leave">
          PL
        </div>
      )
    case "H":
      return (
        <div className="w-8 h-8 bg-blue-500 text-white rounded flex items-center justify-center text-xs font-bold" title="Holiday">
          H
        </div>
      )
    case "HD":
      return (
        <div className="w-8 h-8 bg-yellow-500 text-white rounded flex items-center justify-center text-xs font-bold" title="Half Day">
          HD
        </div>
      )
    case "AB":
      return (
        <div className="w-8 h-8 bg-red-500 text-white rounded flex items-center justify-center text-xs font-bold" title="Absconding">
          AB
        </div>
      )
    case "ISS":
    case "ISSUE":
      return (
        <div className="w-8 h-8 bg-black text-white rounded flex items-center justify-center text-xs font-bold" title="Issue - Missing Punch In/Out">
          ISS
        </div>
      )
    case "Z":
    case "ZERO":
      return (
        <div className="w-8 h-8 bg-black text-white rounded flex items-center justify-center text-xs font-bold" title="Zero - Insufficient Hours">
          0
        </div>
      )
    default:
      return <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center text-xs text-gray-400" title="Not Marked">-</div>
  }
}

const getStatusText = (status) => {
  switch (status) {
    case "P":
      return "PRESENT"
    case "L":
      return "LATE"
    case "LV":
      return "LEAVE APPROVED"
    case "PL":
      return "PENDING LEAVE"
    case "H":
      return "HOLIDAY"
    case "HD":
      return "HALF DAY"
    case "AB":
      return "ABSCONDING"
    case "ISS":
    case "ISSUE":
      return "ISSUE - MISSING PUNCH"
    case "Z":
    case "ZERO":
      return "ZERO - INSUFFICIENT HOURS"
    default:
      return "NOT MARKED"
  }
}

// Get numeric attendance count for calculation
// Present → 1, Half Day → 0.5, Leave/Holiday → 0, Absconding → -1, Issue/Zero → 0
const getAttendanceCount = (status) => {
  switch (status) {
    case "P":
      return 1.0 // Present = Full Day
    case "HD":
      return 0.5 // Half Day = 0.5
    case "AB":
      return -1.0 // Absconding = -1 (penalty)
    case "L":
      return 1.0 // Late but present = 1 (or could be 0.5 based on settings)
    case "LV":
    case "H":
      return 0.0 // Leave and Holiday = 0 (not counted)
    case "PL":
      return 0.0 // Pending Leave = 0 (until approved)
    case "ISS":
    case "ISSUE":
    case "Z":
    case "ZERO":
      return 0.0 // Issue/Zero = 0
    default:
      return 0.0 // Not marked = 0
  }
}

// Get color for status (for styling)
const getStatusColor = (status) => {
  switch (status) {
    case "P":
      return { bg: "#10b981", text: "#ffffff" } // Green
    case "HD":
      return { bg: "#eab308", text: "#ffffff" } // Yellow
    case "LV":
      return { bg: "#f97316", text: "#ffffff" } // Orange
    case "PL":
      return { bg: "#ffffff", text: "#000000", border: "#9ca3af" } // White with border
    case "H":
      return { bg: "#3b82f6", text: "#ffffff" } // Blue
    case "AB":
      return { bg: "#ef4444", text: "#ffffff" } // Red
    case "ISS":
    case "ISSUE":
    case "Z":
    case "ZERO":
      return { bg: "#000000", text: "#ffffff" } // Black
    case "L":
      return { bg: "#f59e0b", text: "#ffffff" } // Amber
    default:
      return { bg: "#6b7280", text: "#ffffff" } // Gray
  }
}

// ============================================
// ATTENDANCE CALCULATION LOGIC (Based on Requirements)
// ============================================

/**
 * Parse time string (HH:MM) to minutes since midnight
 * @param {string} timeStr - Time in "HH:MM" format
 * @returns {number} - Minutes since midnight
 */
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 60) + minutes;
};

/**
 * Calculate time difference in hours
 * @param {string} startTime - Start time in "HH:MM" format
 * @param {string} endTime - End time in "HH:MM" format
 * @returns {number} - Hours difference
 */
const calculateHoursDifference = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  return (endMinutes - startMinutes) / 60;
};

/**
 * Check if punch in is within grace period
 * @param {string} punchInTime - Actual punch in time
 * @param {string} reportingDeadline - Deadline time
 * @param {number} graceMinutes - Grace period in minutes
 * @param {number} graceUsedThisMonth - How many times grace used this month
 * @param {number} graceLimit - Maximum grace usage per month
 * @returns {object} - { isWithinGrace, graceUsed }
 */
const checkGracePeriod = (punchInTime, reportingDeadline, graceMinutes, graceUsedThisMonth, graceLimit) => {
  if (!punchInTime || !reportingDeadline) {
    return { isWithinGrace: false, graceUsed: false };
  }
  
  const punchInMinutes = parseTimeToMinutes(punchInTime);
  const deadlineMinutes = parseTimeToMinutes(reportingDeadline);
  const graceEndMinutes = deadlineMinutes + graceMinutes;
  
  // Check if punch in is after deadline but within grace period
  const isLate = punchInMinutes > deadlineMinutes;
  const isWithinGracePeriod = punchInMinutes <= graceEndMinutes;
  const hasGraceAvailable = graceUsedThisMonth < graceLimit;
  
  const isWithinGrace = isLate && isWithinGracePeriod && hasGraceAvailable;
  
  return {
    isWithinGrace,
    graceUsed: isWithinGrace,
    minutesLate: Math.max(0, punchInMinutes - deadlineMinutes)
  };
};

/**
 * Calculate final attendance status based on all rules
 * @param {object} attendanceData - Attendance data
 * @param {object} settings - Attendance settings
 * @returns {object} - { status, count, reason }
 */
const calculateAttendanceStatus = (attendanceData, settings) => {
  const {
    punch_in,
    punch_out,
    working_hours = 0,
    is_holiday = false,
    leave_status = null,
    is_weekend = false,
    grace_used_this_month = 0
  } = attendanceData;
  
  const {
    reporting_deadline = '10:15',
    full_day_working_hours = 9.0,
    half_day_minimum_working_hours = 5.0,
    grace_period_minutes = 30,
    grace_usage_limit = 2
  } = settings;
  
  // Rule 0: Holiday
  if (is_holiday) {
    return { status: 'H', count: 0, reason: 'Holiday' };
  }
  
  // Rule 1: Weekend
  if (is_weekend) {
    return { status: 'H', count: 0, reason: 'Weekend' };
  }
  
  // Rule 2: Leave Status
  if (leave_status === 'approved') {
    return { status: 'LV', count: 0, reason: 'Leave Approved' };
  }
  if (leave_status === 'pending') {
    return { status: 'PL', count: 0, reason: 'Leave Pending Approval' };
  }
  if (leave_status === 'absconding') {
    return { status: 'AB', count: -1, reason: 'Absconding (Unapproved Leave > 3 days)' };
  }
  
  // Rule 3: Missing Punch In or Punch Out = Issue
  if (!punch_in || !punch_out) {
    return { 
      status: 'ISS', 
      count: 0, 
      reason: !punch_in ? 'Missing Punch In' : 'Missing Punch Out' 
    };
  }
  
  // Rule 4: Working Hours Logic (Main Calculation)
  // This is the PRIMARY rule that determines status
  
  if (working_hours >= full_day_working_hours) {
    // Full Day: Working hours >= 9 hours
    return { status: 'P', count: 1, reason: `Full Day (${working_hours.toFixed(1)} hrs)` };
  }
  
  if (working_hours >= half_day_minimum_working_hours) {
    // Half Day: Working hours >= 5 hrs but < 9 hrs
    return { status: 'HD', count: 0.5, reason: `Half Day (${working_hours.toFixed(1)} hrs)` };
  }
  
  // Zero: Working hours < 5 hrs
  return { status: 'Z', count: 0, reason: `Insufficient Hours (${working_hours.toFixed(1)} hrs)` };
};

/**
 * Determine punch in status (for display purposes)
 * This checks if punch in was late and whether grace was applied
 */
const getPunchInStatus = (punchInTime, reportingDeadline, graceMinutes, graceUsedThisMonth, graceLimit) => {
  if (!punchInTime) return { isLate: false, gracedApplied: false, message: 'Not Punched In' };
  
  const punchInMinutes = parseTimeToMinutes(punchInTime);
  const deadlineMinutes = parseTimeToMinutes(reportingDeadline);
  
  if (punchInMinutes <= deadlineMinutes) {
    return { 
      isLate: false, 
      graceApplied: false, 
      message: 'On Time',
      minutesEarly: deadlineMinutes - punchInMinutes
    };
  }
  
  // Check grace period
  const graceResult = checkGracePeriod(
    punchInTime, 
    reportingDeadline, 
    graceMinutes, 
    graceUsedThisMonth, 
    graceLimit
  );
  
  if (graceResult.isWithinGrace) {
    return {
      isLate: true,
      graceApplied: true,
      message: `Late but grace applied (${graceResult.minutesLate} mins)`,
      minutesLate: graceResult.minutesLate
    };
  }
  
  return {
    isLate: true,
    graceApplied: false,
    message: `Late (${punchInMinutes - deadlineMinutes} mins)`,
    minutesLate: punchInMinutes - deadlineMinutes
  };
};

/**
 * Check if remaining working hours are possible after late punch in
 * @param {string} punchInTime - Actual punch in time
 * @param {string} shiftEndTime - Official shift end time
 * @param {number} requiredHours - Required working hours
 * @returns {object} - { isPossible, remainingHours, message }
 */
const checkRemainingHoursPossible = (punchInTime, shiftEndTime, requiredHours) => {
  if (!punchInTime || !shiftEndTime) {
    return { isPossible: false, remainingHours: 0, message: 'Invalid time' };
  }
  
  const remainingHours = calculateHoursDifference(punchInTime, shiftEndTime);
  const isPossible = remainingHours >= requiredHours;
  
  return {
    isPossible,
    remainingHours: remainingHours.toFixed(1),
    message: isPossible 
      ? `${remainingHours.toFixed(1)} hrs possible` 
      : `Only ${remainingHours.toFixed(1)} hrs possible (need ${requiredHours})`
  };
};

/**
 * Apply Sunday and Sandwich Rules
 * Rule: If Saturday OR Monday is Absconding/Unapproved, Sunday = Zero
 * Rule: If working days < 5 in week, Sunday = Zero
 * @param {object} weekData - Attendance data for the week
 * @param {object} settings - Attendance settings
 * @returns {object} - { shouldApplySundayPenalty, reason }
 */
const checkSundaySandwichRule = (weekData, settings) => {
  const {
    saturday_status,
    monday_status,
    working_days_in_week = 0,
    sunday_penalty_applied = false
  } = weekData;
  
  const {
    enable_sunday_sandwich_rule = true,
    minimum_working_days_for_sunday = 5
  } = settings;
  
  // If rule is disabled, no penalty
  if (!enable_sunday_sandwich_rule) {
    return { shouldApplySundayPenalty: false, reason: 'Sunday sandwich rule disabled' };
  }
  
  // If penalty already applied, don't apply again
  if (sunday_penalty_applied) {
    return { shouldApplySundayPenalty: false, reason: 'Penalty already applied' };
  }
  
  // Check Saturday/Monday absconding or unapproved leave
  const isSaturdayAbsconding = ['AB', 'PL'].includes(saturday_status);
  const isMondayAbsconding = ['AB', 'PL'].includes(monday_status);
  
  if (isSaturdayAbsconding || isMondayAbsconding) {
    return {
      shouldApplySundayPenalty: true,
      reason: `${isSaturdayAbsconding ? 'Saturday' : 'Monday'} absconding/unapproved`
    };
  }
  
  // Check working days in week
  if (working_days_in_week < minimum_working_days_for_sunday) {
    return {
      shouldApplySundayPenalty: true,
      reason: `Only ${working_days_in_week} working days (need ${minimum_working_days_for_sunday})`
    };
  }
  
  return { shouldApplySundayPenalty: false, reason: 'No penalty conditions met' };
};

/**
 * Auto-convert pending leave to absconding after X days
 * @param {object} leaveData - Leave application data
 * @param {object} settings - Attendance settings
 * @returns {object} - { shouldConvert, reason }
 */
const checkLeaveAutoConversion = (leaveData, settings) => {
  const {
    leave_application_date,
    leave_status,
    days_pending
  } = leaveData;
  
  const {
    pending_leave_auto_convert_days = 3
  } = settings;
  
  // Only convert if status is pending
  if (leave_status !== 'pending') {
    return { shouldConvert: false, reason: 'Status is not pending' };
  }
  
  // Check if days exceeded
  if (days_pending >= pending_leave_auto_convert_days) {
    return {
      shouldConvert: true,
      reason: `Pending for ${days_pending} days (limit ${pending_leave_auto_convert_days})`,
      newStatus: 'absconding'
    };
  }
  
  return { shouldConvert: false, reason: 'Within time limit' };
};

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

// Remove the jsPDF imports and replace with this simpler approach
const exportToPDF = (attendanceData, selectedYear, selectedMonth, holidays) => {
  // Create HTML content for the report
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()

  // Generate HTML table
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Monthly Attendance Report - ${months[selectedMonth - 1]} ${selectedYear}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .info { margin-bottom: 15px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th, td { border: 1px solid #ddd; padding: 4px; text-align: center; }
        th { background-color: #2980b9; color: white; font-weight: bold; }
        .employee-info { text-align: left; min-width: 120px; }
        .summary { text-align: left; font-size: 9px; }
        .status-P { background-color: #10b981; color: white; font-weight: bold; }
        .status-A { background-color: #ef4444; color: white; font-weight: bold; }
        .status-L { background: linear-gradient(135deg, #eab308, #f97316); color: white; font-weight: bold; }
        .status-LV { background-color: #f97316; color: white; font-weight: bold; }
        .status-H { background-color: #3b82f6; color: white; font-weight: bold; }
        .status-HD { background-color: #eab308; color: white; font-weight: bold; }
        .status-AB { background-color: #ef4444; color: white; font-weight: bold; }
        .legend { margin-top: 20px; font-size: 11px; }
        .legend-item { display: inline-block; margin-right: 15px; margin-bottom: 5px; }
        .legend-color { display: inline-block; width: 20px; height: 15px; margin-right: 5px; vertical-align: middle; }
        .monthly-summary { margin-top: 20px; font-size: 12px; }
        @media print { body { margin: 10px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h2></h2>
        <h3>${months[selectedMonth - 1]} ${selectedYear}</h3>
      </div>
      
      <div class="info">
        <strong>Generated on:</strong> ${formatDateTime(new Date())}<br>
  `

  // Add holidays info
  const currentMonthHolidays = holidays.filter((holiday) => {
    const holidayDate = new Date(holiday.date)
    return holidayDate.getFullYear() === selectedYear && holidayDate.getMonth() + 1 === selectedMonth
  })

  if (currentMonthHolidays.length > 0) {
    htmlContent += `<strong>Company Holidays:</strong> ${currentMonthHolidays.map((h) => h.name).join(", ")}<br>`
  }

  htmlContent += `
      </div>
      
      <table>
        <thead>
          <tr>
            <th class="employee-info">Employee Details</th>
  `

  // Add day headers
  for (let day = 1; day <= daysInMonth; day++) {
    const dayName = getDayName(selectedYear, selectedMonth, day)
    htmlContent += `<th>${day}<br><small>${dayName.substring(0, 3)}</small></th>`
  }

  htmlContent += `
            <th>Present</th>
            <th>Late</th>
            <th>Half Day</th>
            <th>Holidays</th>
            <th>Absconding</th>
            <th>Attendance %</th>
          </tr>
        </thead>
        <tbody>
  `

  // Add employee rows
  attendanceData.forEach((record) => {
    const stats = calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays)

    htmlContent += `
      <tr>
        <td class="employee-info">
          <strong>${record.name}</strong><br>
          <small>${record.employeeId}</small><br>
          <small>${record.department}</small>
        </td>
    `

    // Add attendance data for each day
    for (let day = 1; day <= daysInMonth; day++) {
      const status = record[`day${day}`] || "-"
      htmlContent += `<td class="status-${status}">${status}</td>`
    }

    // Add summary stats
    htmlContent += `
        <td>${stats.present}</td>
        <td>${stats.late}</td>
        <td>${stats.halfDay}</td>
        <td>${stats.holidays}</td>
        <td>${stats.absconding}</td>
        <td>${stats.attendancePercentage}%</td>
      </tr>
    `
  })

  htmlContent += `
        </tbody>
      </table>
      
      <div class="legend">
        <h4>Legend:</h4>
        <div class="legend-item">
          <span class="legend-color" style="background-color: #10b981;"></span>P = Present
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background: linear-gradient(135deg, #eab308, #f97316);"></span>L = Late
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background-color: #f97316;"></span>LV = Leave Approved
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background-color: #ffffff; border: 2px solid #9ca3af;"></span>PL = Pending Leave
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background-color: #3b82f6;"></span>H = Holiday
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background-color: #eab308;"></span>HD = Half Day
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background-color: #ef4444;"></span>AB = Absconding
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background-color: #000000;"></span>ISS = Issue (Missing Punch)
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background-color: #000000;"></span>0 = Zero (Insufficient Hours)
        </div>
      </div>
      
      <div class="monthly-summary">
        <h4>Monthly Summary:</h4>
  `

  // Calculate totals
  const totalPresent = attendanceData.reduce((acc, record) => {
    const stats = calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays)
    return acc + stats.present
  }, 0)

  const totalLate = attendanceData.reduce((acc, record) => {
    const stats = calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays)
    return acc + stats.late
  }, 0)

  const avgAttendance = (
    attendanceData.reduce((acc, record) => {
      const stats = calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays)
      return acc + Number.parseFloat(stats.attendancePercentage)
    }, 0) / attendanceData.length
  ).toFixed(1)

  htmlContent += `
        <p><strong>Total Present Days:</strong> ${totalPresent}</p>
        <p><strong>Total Late Days:</strong> ${totalLate}</p>
        <p><strong>Average Attendance:</strong> ${avgAttendance}%</p>
      </div>
    </body>
    </html>
  `

  // Create and download the HTML file
  const blob = new Blob([htmlContent], { type: "text/html" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `Attendance_Report_${months[selectedMonth - 1]}_${selectedYear}.html`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  // Also offer to print (which can save as PDF)
  const printWindow = window.open("", "_blank")
  printWindow.document.write(htmlContent)
  printWindow.document.close()

  // Auto-trigger print dialog after a short delay
  setTimeout(() => {
    printWindow.print()
  }, 500)
}

// Holiday Management Modal Component
const HolidayManagementModal = ({ isOpen, onClose, holidays, onUpdateHolidays, selectedYear, selectedMonth }) => {
  const [newHolidayDate, setNewHolidayDate] = useState("")
  const [newHolidayName, setNewHolidayName] = useState("")
  const [newHolidayDescription, setNewHolidayDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [localHolidays, setLocalHolidays] = useState([])
  const [error, setError] = useState("")

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
    if (!newHolidayDate || !newHolidayName || !user?.user_id) {
      setError("Please fill in all required fields")
      return
    }

    setLoading(true)
    setError("")
    try {
      const response = await attendanceAPI.addHoliday(
        newHolidayName,
        newHolidayDate,
        newHolidayDescription,
        user.user_id
      )
      
      if (response.success) {
        // Reload holidays to get updated list
        await loadHolidays()
        // Clear form
        setNewHolidayDate("")
        setNewHolidayName("")
        setNewHolidayDescription("")
        // Update parent component
        onUpdateHolidays(localHolidays)
      } else {
        setError(response.message || "Failed to add holiday")
      }
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
      const response = await attendanceAPI.deleteHoliday(holidayId, user.user_id)
      
      if (response.success) {
        // Reload holidays to get updated list
        await loadHolidays()
        // Update parent component
        onUpdateHolidays(localHolidays.filter(h => h._id !== holidayId))
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
    return formatDateTime(dateString);
  }

  return (
    <div className="fixed inset-0 bg-transparent bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white p-4 rounded-t-lg relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors">
            <X className="h-6 w-6" />
          </button>
          <h2 className="text-xl font-bold">Holiday Management</h2>
          <p className="text-cyan-100 text-sm mt-1">Manage company holidays for {months[selectedMonth - 1]} {selectedYear}</p>
        </div>

        <div className="p-6 bg-gray-900">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && (
            <div className="mb-4 flex items-center justify-center py-4">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500"></div>
              <span className="text-gray-300 ml-2">Processing...</span>
            </div>
          )}

          {/* Add New Holiday */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Add New Holiday</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Holiday Date *</label>
                  <input
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    className="w-full p-3 border border-gray-600 rounded-lg bg-gray-800 text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Holiday Name *</label>
                  <input
                    type="text"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    placeholder="e.g., Independence Day"
                    className="w-full p-3 border border-gray-600 rounded-lg bg-gray-800 text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    disabled={loading}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description (Optional)</label>
                <input
                  type="text"
                  value={newHolidayDescription}
                  onChange={(e) => setNewHolidayDescription(e.target.value)}
                  placeholder="Additional details about the holiday"
                  className="w-full p-3 border border-gray-600 rounded-lg bg-gray-800 text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  disabled={loading}
                />
              </div>
            </div>
            <button
              onClick={handleAddHoliday}
              disabled={loading || !newHolidayDate || !newHolidayName}
              className="mt-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white px-6 py-2 flex items-center gap-2 rounded-md transition-colors"
            >
              <Plus className="h-4 w-4" />
              {loading ? 'Adding...' : 'Add Holiday'}
            </button>
          </div>

          {/* Current Month Holidays */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">
              Holidays for {months[selectedMonth - 1]} {selectedYear}
            </h3>
            {currentMonthHolidays.length === 0 ? (
              <div className="text-center py-8 bg-gray-800 rounded-lg border border-gray-700">
                <p className="text-gray-400">No holidays set for this month</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentMonthHolidays.map((holiday) => (
                  <div key={holiday._id} className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-lg">
                    <div>
                      <div className="font-semibold text-gray-200">{holiday.name}</div>
                      <div className="text-sm text-gray-400">{formatDate(holiday.date)}</div>
                      {holiday.description && (
                        <div className="text-sm text-gray-500 mt-1">{holiday.description}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveHoliday(holiday._id)}
                      disabled={loading}
                      className="text-red-400 border border-red-700 hover:bg-red-900/50 disabled:opacity-50 px-3 py-1 rounded-md text-sm transition-colors flex items-center gap-1"
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
            <h3 className="text-lg font-semibold text-gray-200 mb-4">All Company Holidays</h3>
            {localHolidays.length === 0 ? (
              <div className="text-center py-8 bg-gray-800 rounded-lg border border-gray-700">
                <p className="text-gray-400">No holidays configured</p>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 bg-gray-800 rounded-lg border border-gray-700 p-4">
                {localHolidays
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .map((holiday) => (
                    <div
                      key={holiday._id}
                      className="flex items-center justify-between p-3 bg-gray-700 rounded border border-gray-600 text-sm"
                    >
                      <div>
                        <span className="font-medium text-gray-200">{holiday.name}</span>
                        <span className="text-gray-400 ml-2">{formatDate(holiday.date)}</span>
                        {holiday.description && (
                          <div className="text-gray-500 text-xs mt-1">{holiday.description}</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveHoliday(holiday._id)}
                        disabled={loading}
                        className="text-red-400 border border-red-700 hover:bg-red-900/50 disabled:opacity-50 px-2 py-1 rounded-md text-sm transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Close Button */}
          <div className="mt-6 flex justify-end">
            <button onClick={onClose} className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-2 rounded-md transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Employee Detail Modal Component
const EmployeeDetailModal = ({ employee, selectedDate, isOpen, onClose, onUpdate, selectedYear, selectedMonth, canUserEdit }) => {
  const [selectedAttendance, setSelectedAttendance] = useState("")
  const [showHistory, setShowHistory] = useState(false)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState("")
  const [history, setHistory] = useState([])
  const [attendanceDetail, setAttendanceDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)

  // Get user data
  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      setUser(JSON.parse(userData))
    }
  }, [])

  // Load attendance detail when modal opens
  useEffect(() => {
    if (isOpen && employee && selectedDate && user?.user_id) {
      loadAttendanceDetail()
    }
  }, [isOpen, employee, selectedDate, user])

  // Check edit permissions using the imported permission functions
  const hasEditPermission = () => {
    if (!employee?.id) return false;
    
    // For attendance, regular users (own only) should NOT be able to edit even their own records
    const level = getPermissionLevel('attendance');
    if (level === 'own') {
      return false; // Regular users cannot edit attendance records
    }
    
    // Use the passed function if available, otherwise use direct import
    if (canUserEdit && typeof canUserEdit === 'function') {
      return canUserEdit(employee.id);
    }
    
    // Fallback: use direct permission check
    return canEdit('attendance', employee.id);
  };

  const loadAttendanceDetail = async () => {
    if (!employee || !selectedDate || !user?.user_id) return
    
    setLoading(true)
    try {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`
      
      // Load attendance detail
      const detailData = await attendanceAPI.getAttendanceDetail(employee.id, dateStr, user.user_id)
      setAttendanceDetail(detailData)
      
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
        const historyData = await attendanceAPI.getHistory(employee.id, dateStr, user.user_id)
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

  const currentStatus = employee[`day${selectedDate}`] || "A"
  const statusText = getStatusText(currentStatus)

  const formatDate = (year, month, day) => {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const handleUpdate = async () => {
    // Validation: Status and comment are mandatory
    if (!selectedAttendance) {
      alert('Please select a new attendance status.')
      return
    }
    
    if (!newComment.trim()) {
      alert('Comment is mandatory for manual override. Please provide a reason.')
      return
    }
    
    if (!user?.user_id) {
      alert('User information not found. Please login again.')
      return
    }
    
    setLoading(true)
    try {
      // Convert status code to numeric value for backend
      // Present → 1, Half Day → 0.5, Leave/Holiday → 0, Absconding → -1, Issue/Zero → 0
      let statusValue = getAttendanceCount(selectedAttendance)
      
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`
      
      // If we have an attendance record, edit it
      if (attendanceDetail?.id) {
        const editData = {
          status: statusValue,
          status_code: selectedAttendance, // Store the code
          comments: newComment.trim(),
          is_manual_override: true, // Flag for manual override
          override_by: user.user_id,
          override_by_name: user.name || user.userName,
          override_date: new Date().toISOString(),
          old_status: currentStatus // Store old status for history
        }
        await attendanceAPI.editAttendance(attendanceDetail.id, editData, user.user_id)
      } else {
        // Create new attendance record with manual override
        const attendanceData = {
          employee_id: employee.id,
          date: dateStr,
          status: statusValue,
          status_code: selectedAttendance,
          comments: newComment.trim(),
          is_manual_override: true,
          override_by: user.user_id,
          override_by_name: user.name || user.userName,
          check_in_time: null,
          check_out_time: null,
          is_holiday: selectedAttendance === 'H'
        }
        await attendanceAPI.markAttendance(attendanceData, user.user_id)
      }
      
      // Update parent component
      if (onUpdate) {
        onUpdate(employee.id, selectedDate, selectedAttendance)
      }
      
      // Clear form
      setSelectedAttendance("")
      setNewComment("")
      
      // Reload detail to get updated data
      await loadAttendanceDetail()
      
      alert(`✅ Attendance updated successfully!\n\nOld Status: ${getStatusText(currentStatus)}\nNew Status: ${getStatusText(selectedAttendance)}\n\nComment: ${newComment.trim()}`)
    } catch (error) {
      console.error('Error updating attendance:', error)
      alert('❌ Failed to update attendance. Please try again.\n\nError: ' + (error.response?.data?.detail || error.message))
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
      alert('Failed to add comment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-transparent bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white p-4 rounded-t-lg relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors">
            <X className="h-6 w-6" />
          </button>
          <h2 className="text-xl font-bold">ADMIN PANEL</h2>
        </div>

        {/* Employee Info */}
        <div className=" bg-gray-800 border-b border border-gray-700">
          <div className="text-gray-200 space-y-2">
            <p className="font-semibold text-cyan-400">{employee.department.toUpperCase()} | ADMIN</p>
            <p className="text-gray-300">EMP-ID: {employee.employee_code || employee.employee_number || employee.empId || `EMP-${employee.id?.slice(-6) || 'UNKNOWN'}`}</p>
            <p className="text-gray-300">ATTENDANCE: <span className="text-cyan-400 font-semibold">{statusText}</span></p>
            {attendanceDetail && (
              <>
                <p className="text-gray-300">EMPLOYEE NAME: <span className="text-cyan-400">{attendanceDetail.employee?.employee_name || attendanceDetail.employee_name}</span></p>
                <p className="text-gray-300">DATE: <span className="text-cyan-400">{attendanceDetail.date}</span></p>
                <p className="text-gray-300">STATUS: <span className="text-cyan-400">{attendanceDetail.status_text}</span></p>
                
                {/* Show leave details if type is leave */}
                {attendanceDetail.type === 'leave' && attendanceDetail.leave_details && (
                  <>
                    <p className="text-gray-300">LEAVE TYPE: <span className="text-orange-400">{attendanceDetail.leave_details.leave_type_display}</span></p>
                    <p className="text-gray-300">REASON: <span className="text-yellow-400">{attendanceDetail.leave_details.reason}</span></p>
                    <p className="text-gray-300">DURATION: <span className="text-green-400">{attendanceDetail.leave_details.duration_days} day(s)</span></p>
                    <p className="text-gray-300">APPROVED BY: <span className="text-purple-400">{attendanceDetail.leave_details.approved_by_name}</span></p>
                    {attendanceDetail.leave_details.approval_comments && (
                      <p className="text-gray-300">APPROVAL COMMENTS: <span className="text-blue-400">{attendanceDetail.leave_details.approval_comments}</span></p>
                    )}
                  </>
                )}
                
                {/* Show attendance details if type is attendance */}
                {attendanceDetail.type === 'attendance' && (
                  <>
                    {attendanceDetail.attendance_details?.total_working_hours && (
                      <p className="text-gray-300">TOTAL HOURS: <span className="text-green-400">{attendanceDetail.attendance_details.total_working_hours} hours</span></p>
                    )}
                    {attendanceDetail.working_hours && (
                      <p className="text-gray-300">TOTAL HOURS: <span className="text-green-400">{attendanceDetail.working_hours} hours</span></p>
                    )}
                    {attendanceDetail.is_late && (
                      <p className="text-gray-300">LATE: <span className="text-yellow-400">Yes</span></p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Check In/Out Sections or Leave Details */}
        <div className="p-6 bg-gray-900">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
              <p className="text-gray-400 mt-2">Loading attendance details...</p>
            </div>
          ) : (
            <>
              {/* Late Punch & Issue Alerts Section */}
              {attendanceDetail?.type !== 'leave' && (
                <div className="mb-6 space-y-4">
                  {/* Late Punch Alert */}
                  {attendanceDetail?.is_late && (
                    <div className="bg-gradient-to-r from-yellow-700/20 to-orange-700/20 border-2 border-yellow-500 rounded-lg p-5">
                      <div className="flex items-start gap-3">
                        <div className="text-yellow-400 text-3xl">⏰</div>
                        <div className="flex-1">
                          <h3 className="font-bold text-yellow-400 text-lg mb-2">LATE PUNCH IN DETECTED</h3>
                          <p className="text-gray-200 mb-3">
                            {attendanceDetail.late_message || 'You punched in late today.'}
                          </p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Shift Timing */}
                            <div className="bg-gray-800 border border-yellow-500 rounded-lg p-4">
                              <h4 className="text-yellow-300 font-semibold mb-2 flex items-center gap-2">
                                <span>🕐</span>
                                <span>Shift Timing</span>
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Shift Start:</span>
                                  <span className="text-white font-semibold">10:00 AM</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Deadline:</span>
                                  <span className="text-orange-400 font-semibold">10:15 AM</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Grace Window:</span>
                                  <span className="text-teal-400 font-semibold">30 mins</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Your Timing */}
                            <div className="bg-gray-800 border border-yellow-500 rounded-lg p-4">
                              <h4 className="text-yellow-300 font-semibold mb-2 flex items-center gap-2">
                                <span>📍</span>
                                <span>Your Timing</span>
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Punch In:</span>
                                  <span className="text-cyan-400 font-bold">{attendanceDetail.check_in_time || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Late By:</span>
                                  <span className="text-red-400 font-bold">{attendanceDetail.minutes_late || 0} mins</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Grace Used?</span>
                                  <span className={`font-bold ${attendanceDetail.grace_applied_today ? 'text-yellow-400' : 'text-gray-400'}`}>
                                    {attendanceDetail.grace_applied_today ? 'Yes ✓' : 'No'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Impact */}
                            <div className="bg-gray-800 border border-yellow-500 rounded-lg p-4">
                              <h4 className="text-yellow-300 font-semibold mb-2 flex items-center gap-2">
                                <span>⚠️</span>
                                <span>Impact</span>
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Status:</span>
                                  <span className="text-yellow-400 font-bold">Late (L)</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Final Count:</span>
                                  <span className={`font-bold ${attendanceDetail.grace_applied_today ? 'text-green-400' : 'text-orange-400'}`}>
                                    {attendanceDetail.grace_applied_today ? 'Full (1)' : 'Based on Hours'}
                                  </span>
                                </div>
                                {!attendanceDetail.grace_applied_today && (
                                  <div className="text-xs text-orange-300 mt-2">
                                    ⚠️ Grace limit exhausted! Final status depends on working hours.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-3 bg-yellow-900/40 border border-yellow-600 rounded p-3">
                            <h4 className="text-yellow-300 font-bold mb-2">💡 What This Means:</h4>
                            <ul className="text-gray-200 text-sm space-y-1 list-disc list-inside">
                              <li>Shift starts at <strong>10:00 AM</strong>, reporting deadline is <strong>10:15 AM</strong></li>
                              <li>You have a <strong>30-minute grace window</strong> (10:15 - 10:45 AM)</li>
                              <li>Grace period can be used <strong>maximum 2 times per month</strong></li>
                              <li>After grace limit, late punch = <strong>Half Day or based on working hours</strong></li>
                              {attendanceDetail.remaining_hours_possible !== undefined && (
                                <li>Remaining possible hours: <strong className="text-cyan-400">{attendanceDetail.remaining_hours_possible} hrs</strong></li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Missing Punch Issue Alert */}
                  {attendanceDetail?.has_missing_punch && (
                    <div className="bg-gradient-to-r from-red-700/20 to-pink-700/20 border-2 border-red-500 rounded-lg p-5">
                      <div className="flex items-start gap-3">
                        <div className="text-red-400 text-3xl">❌</div>
                        <div className="flex-1">
                          <h3 className="font-bold text-red-400 text-lg mb-2">ISSUE: MISSING PUNCH</h3>
                          <p className="text-gray-200 mb-3">
                            {attendanceDetail.missing_punch_message || 'You have missing punch in/out records.'}
                          </p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Missing Punch Details */}
                            <div className="bg-gray-800 border border-red-500 rounded-lg p-4">
                              <h4 className="text-red-300 font-semibold mb-3 flex items-center gap-2">
                                <span>🔍</span>
                                <span>Missing Records</span>
                              </h4>
                              <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                  <span className={`text-2xl ${attendanceDetail.check_in_time ? '✅' : '❌'}`}></span>
                                  <div>
                                    <div className="text-gray-400 text-sm">Check In</div>
                                    <div className={`font-semibold ${attendanceDetail.check_in_time ? 'text-green-400' : 'text-red-400'}`}>
                                      {attendanceDetail.check_in_time || 'MISSING'}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={`text-2xl ${attendanceDetail.check_out_time ? '✅' : '❌'}`}></span>
                                  <div>
                                    <div className="text-gray-400 text-sm">Check Out</div>
                                    <div className={`font-semibold ${attendanceDetail.check_out_time ? 'text-green-400' : 'text-red-400'}`}>
                                      {attendanceDetail.check_out_time || 'MISSING'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Resolution Steps */}
                            <div className="bg-gray-800 border border-red-500 rounded-lg p-4">
                              <h4 className="text-red-300 font-semibold mb-3 flex items-center gap-2">
                                <span>✏️</span>
                                <span>How to Fix</span>
                              </h4>
                              <div className="space-y-2 text-sm text-gray-200">
                                <div className="flex items-start gap-2">
                                  <span className="text-cyan-400 font-bold">1.</span>
                                  <span>Contact your <strong>Team Leader</strong> or <strong>HR</strong></span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-cyan-400 font-bold">2.</span>
                                  <span>Provide valid reason for missing punch</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-cyan-400 font-bold">3.</span>
                                  <span>HR will manually correct the record</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-cyan-400 font-bold">4.</span>
                                  <span>Until fixed, this day is marked as <strong className="text-red-400">Issue (ISS)</strong></span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-3 bg-red-900/40 border border-red-600 rounded p-3">
                            <h4 className="text-red-300 font-bold mb-2">⚠️ Important:</h4>
                            <p className="text-gray-200 text-sm">
                              Days with missing punch are marked as <strong className="text-red-400">Issue (ISS = 0 count)</strong>.
                              If you forgot to punch in/out, apply for <strong>retroactive attendance correction</strong> through your manager.
                              HR can manually add/correct the punch records if valid reason is provided.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* No Issues - Clean Record */}
                  {!attendanceDetail?.is_late && !attendanceDetail?.has_missing_punch && attendanceDetail?.check_in_time && (
                    <div className="bg-gradient-to-r from-green-700/20 to-emerald-700/20 border-2 border-green-500 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="text-green-400 text-2xl">✅</div>
                        <div>
                          <h3 className="font-bold text-green-400">On-Time & Complete</h3>
                          <p className="text-gray-300 text-sm">
                            Punched in on time at <strong className="text-cyan-400">{attendanceDetail.check_in_time}</strong>. No issues detected.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {attendanceDetail?.type === 'leave' ? (
                /* Leave Details Section */
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-orange-600 to-yellow-600 text-white p-4 rounded-lg">
                <h3 className="text-xl font-bold mb-2">🏖️ LEAVE DETAILS</h3>
                <p className="text-orange-100">Employee is on approved leave for this date</p>
              </div>
              
              {attendanceDetail.leave_details && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Leave Information */}
                  <div className="border border-gray-600 rounded-lg bg-gray-800">
                    <div className="bg-gray-700 p-3 border-b border-gray-600">
                      <h3 className="font-semibold text-gray-200">LEAVE INFORMATION</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Leave Type:</span>
                        <span className="text-orange-400 font-semibold">{attendanceDetail.leave_details.leave_type_display}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Duration:</span>
                        <span className="text-green-400 font-semibold">{attendanceDetail.leave_details.duration_days} day(s)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Status:</span>
                        <span className="text-green-400 font-semibold uppercase">{attendanceDetail.leave_details.status_display || attendanceDetail.leave_details.status}</span>
                      </div>
                      {attendanceDetail.leave_details.from_date && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">From Date:</span>
                          <span className="text-cyan-400">{formatDateTime(attendanceDetail.leave_details.from_date)}</span>
                        </div>
                      )}
                      {attendanceDetail.leave_details.to_date && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">To Date:</span>
                          <span className="text-cyan-400">{formatDateTime(attendanceDetail.leave_details.to_date)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Leave Reason & Approval */}
                  <div className="border border-gray-600 rounded-lg bg-gray-800">
                    <div className="bg-gray-700 p-3 border-b border-gray-600">
                      <h3 className="font-semibold text-gray-200">REASON & APPROVAL</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <span className="text-gray-400 block mb-1">Reason:</span>
                        <div className="bg-gray-700 p-3 rounded border text-yellow-400">
                          {attendanceDetail.leave_details.reason || 'No reason provided'}
                        </div>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-400">Approved By:</span>
                        <span className="text-purple-400 font-semibold">{attendanceDetail.leave_details.approved_by_name || 'Unknown'}</span>
                      </div>
                      
                      {attendanceDetail.leave_details.approved_at && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Approved At:</span>
                          <span className="text-cyan-400">{formatDateTime(attendanceDetail.leave_details.approved_at)}</span>
                        </div>
                      )}
                      
                      {attendanceDetail.leave_details.approval_comments && (
                        <div>
                          <span className="text-gray-400 block mb-1">Approval Comments:</span>
                          <div className="bg-gray-700 p-3 rounded border text-blue-400">
                            {attendanceDetail.leave_details.approval_comments}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Leave Summary Card */}
              {attendanceDetail.leave_details?.leave_summary && (
                <div className="border border-orange-500 rounded-lg bg-gradient-to-r from-orange-900/20 to-yellow-900/20">
                  <div className="p-4">
                    <h4 className="font-semibold text-orange-400 mb-2">📋 Leave Summary</h4>
                    <p className="text-gray-200">{attendanceDetail.leave_details.leave_summary}</p>
                  </div>
                </div>
              )}

              {/* Attachments if any */}
              {attendanceDetail.leave_details?.attachments && attendanceDetail.leave_details.attachments.length > 0 && (
                <div className="border border-gray-600 rounded-lg bg-gray-800">
                  <div className="bg-gray-700 p-3 border-b border-gray-600">
                    <h3 className="font-semibold text-gray-200">📎 ATTACHMENTS</h3>
                  </div>
                  <div className="p-4">
                    <div className="space-y-2">
                      {attendanceDetail.leave_details.attachments.map((attachment, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-700 p-3 rounded">
                          <span className="text-gray-200">{attachment.filename || `Attachment ${index + 1}`}</span>
                          <button 
                            onClick={() => window.open(`${BASE_URL}/media/${attachment.relative_path || attachment.file_path}`, '_blank')}
                            className="text-cyan-400 hover:text-cyan-300 underline"
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Regular Check In/Out Sections for Attendance */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Check In */}
              <div className="border border-gray-600 rounded-lg bg-gray-800">
                <div className="bg-gray-700 p-3 border-b border-gray-600">
                  <h3 className="font-semibold text-gray-200">CHECK IN</h3>
                </div>
                <div className="p-4">
                  <div className="bg-gray-700 rounded-lg p-4 text-center mb-4">
                    {(attendanceDetail?.check_in_photo || attendanceDetail?.attendance_details?.check_in_photo_path) ? (
                      <img 
                        src={`${BASE_URL}/${attendanceDetail.check_in_photo || attendanceDetail.attendance_details.check_in_photo_path}`}
                        alt="Check-in photo"
                        className="w-full h-32 object-cover rounded-lg mx-auto mb-2"
                        onError={(e) => {
                          console.error('Failed to load check-in image:', e.target.src);
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'block';
                        }}
                      />
                    ) : null}
                    <div className={`${(attendanceDetail?.check_in_photo || attendanceDetail?.attendance_details?.check_in_photo_path) ? 'hidden' : 'block'}`}>
                      <Frown className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-400">not found</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-400">
                    <p className="text-gray-300">PUNCH IN DATE: {formatDate(selectedYear, selectedMonth, selectedDate)}</p>
                    <p className="text-gray-300">PUNCH IN TIME: {(attendanceDetail?.check_in_time || attendanceDetail?.attendance_details?.check_in_time) || 'N/A'}</p>
                    {attendanceDetail?.check_in_geolocation?.address && attendanceDetail.check_in_geolocation.address !== 'Unknown' && (
                      <p className="text-gray-300">LOCATION: {attendanceDetail.check_in_geolocation.address}</p>
                    )}
                    {attendanceDetail?.attendance_details?.check_in_geolocation?.address && attendanceDetail.attendance_details.check_in_geolocation.address !== 'Unknown' && (
                      <p className="text-gray-300">LOCATION: {attendanceDetail.attendance_details.check_in_geolocation.address}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Check Out */}
              <div className="border border-gray-600 rounded-lg bg-gray-800">
                <div className="bg-gray-700 p-3 border-b border-gray-600">
                  <h3 className="font-semibold text-gray-200">CHECK OUT</h3>
                </div>
                <div className="p-4">
                  <div className="bg-gray-700 rounded-lg p-4 text-center mb-4">
                    {(attendanceDetail?.check_out_photo || attendanceDetail?.attendance_details?.check_out_photo_path) ? (
                      <img 
                        src={`${BASE_URL}/${attendanceDetail.check_out_photo || attendanceDetail.attendance_details.check_out_photo_path}`}
                        alt="Check-out photo"
                        className="w-full h-32 object-cover rounded-lg mx-auto mb-2"
                        onError={(e) => {
                          console.error('Failed to load check-out image:', e.target.src);
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'block';
                        }}
                      />
                    ) : null}
                    <div className={`${(attendanceDetail?.check_out_photo || attendanceDetail?.attendance_details?.check_out_photo_path) ? 'hidden' : 'block'}`}>
                      <Frown className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-400">not found</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-400">
                    <p className="text-gray-300">PUNCH OUT DATE: {formatDate(selectedYear, selectedMonth, selectedDate)}</p>
                    <p className="text-gray-300">PUNCH OUT TIME: {(attendanceDetail?.check_out_time || attendanceDetail?.attendance_details?.check_out_time) || 'N/A'}</p>
                    {attendanceDetail?.check_out_geolocation?.address && attendanceDetail.check_out_geolocation.address !== 'Unknown' && (
                      <p className="text-gray-300">LOCATION: {attendanceDetail.check_out_geolocation.address}</p>
                    )}
                    {attendanceDetail?.attendance_details?.check_out_geolocation?.address && attendanceDetail.attendance_details.check_out_geolocation.address !== 'Unknown' && (
                      <p className="text-gray-300">LOCATION: {attendanceDetail.attendance_details.check_out_geolocation.address}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          </>
          )}

          {/* Grace Period Tracking Section */}
          {attendanceDetail?.type !== 'leave' && (
            <div className="mt-6 bg-gradient-to-r from-teal-700/20 to-green-700/20 border-2 border-teal-500 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-teal-400 text-2xl">⏰</div>
                <div>
                  <h3 className="font-bold text-teal-400 text-lg">GRACE PERIOD TRACKING</h3>
                  <p className="text-gray-300 text-sm">Monitor late punch-in grace period usage</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Grace Period Settings */}
                <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
                  <h4 className="text-gray-200 font-semibold mb-3 flex items-center gap-2">
                    <span>⚙️</span>
                    <span>Grace Period Settings</span>
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Grace Window:</span>
                      <span className="text-teal-400 font-semibold">30 minutes</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Monthly Limit:</span>
                      <span className="text-teal-400 font-semibold">2 times</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Deadline:</span>
                      <span className="text-orange-400 font-semibold">10:15 AM</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className="text-xs text-gray-400">
                      💡 If you punch in within 30 minutes after the deadline (10:00 AM), it's considered grace period.
                      After using 2 grace periods in a month, late punch = Half Day.
                    </p>
                  </div>
                </div>
                
                {/* Grace Usage This Month */}
                <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
                  <h4 className="text-gray-200 font-semibold mb-3 flex items-center gap-2">
                    <span>📊</span>
                    <span>This Month's Usage</span>
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Grace Used:</span>
                      <span className="text-yellow-400 font-bold text-xl">
                        {attendanceDetail?.grace_used_this_month || 0} / 2
                      </span>
                    </div>
                    
                    {/* Visual Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Usage Progress</span>
                        <span>{Math.round(((attendanceDetail?.grace_used_this_month || 0) / 2) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            (attendanceDetail?.grace_used_this_month || 0) >= 2 
                              ? 'bg-red-500' 
                              : (attendanceDetail?.grace_used_this_month || 0) >= 1 
                                ? 'bg-yellow-500' 
                                : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(((attendanceDetail?.grace_used_this_month || 0) / 2) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Remaining:</span>
                      <span className={`font-bold text-xl ${
                        (2 - (attendanceDetail?.grace_used_this_month || 0)) > 0 
                          ? 'text-green-400' 
                          : 'text-red-400'
                      }`}>
                        {Math.max(0, 2 - (attendanceDetail?.grace_used_this_month || 0))}
                      </span>
                    </div>
                    
                    {(attendanceDetail?.grace_used_this_month || 0) >= 2 && (
                      <div className="bg-red-900/30 border border-red-500 rounded p-2 mt-2">
                        <p className="text-red-400 text-xs font-semibold">
                          ⚠️ Grace limit exhausted! Next late punch will be Half Day.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Today's Grace Status */}
              {attendanceDetail?.grace_applied_today && (
                <div className="mt-4 bg-yellow-900/20 border-2 border-yellow-500 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-yellow-400 text-xl">✅</div>
                    <div className="flex-1">
                      <h4 className="text-yellow-400 font-bold mb-1">Grace Period Used Today</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-400">Punch In Time:</span>
                          <span className="text-white font-semibold ml-2">{attendanceDetail.check_in_time}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Minutes Late:</span>
                          <span className="text-orange-400 font-semibold ml-2">{attendanceDetail.minutes_late || 0} mins</span>
                        </div>
                      </div>
                      <p className="text-gray-300 text-xs mt-2">
                        💡 This counts as one grace period usage for this month.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Grace History (Optional) */}
              {attendanceDetail?.grace_history && attendanceDetail.grace_history.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-gray-200 font-semibold mb-2 flex items-center gap-2">
                    <span>📜</span>
                    <span>Grace Usage History (This Month)</span>
                  </h4>
                  <div className="bg-gray-800 border border-gray-600 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-300">Date</th>
                          <th className="px-3 py-2 text-left text-gray-300">Punch In</th>
                          <th className="px-3 py-2 text-left text-gray-300">Minutes Late</th>
                          <th className="px-3 py-2 text-left text-gray-300">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceDetail.grace_history.map((grace, index) => (
                          <tr key={index} className="border-t border-gray-700 hover:bg-gray-750">
                            <td className="px-3 py-2 text-gray-200">{grace.date}</td>
                            <td className="px-3 py-2 text-cyan-400">{grace.punch_in_time}</td>
                            <td className="px-3 py-2 text-orange-400">{grace.minutes_late} mins</td>
                            <td className="px-3 py-2">
                              <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">Grace Applied</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sunday Sandwich Rule & Leave Alerts Section */}
          {attendanceDetail?.type !== 'leave' && (
            <div className="mt-6 space-y-4">
              {/* Sunday Sandwich Rule Warning */}
              {attendanceDetail?.sunday_sandwich_warning && (
                <div className="bg-gradient-to-r from-red-700/20 to-orange-700/20 border-2 border-red-500 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <div className="text-red-400 text-3xl">⚠️</div>
                    <div className="flex-1">
                      <h3 className="font-bold text-red-400 text-lg mb-2">SUNDAY SANDWICH RULE ALERT</h3>
                      <p className="text-gray-200 mb-3">
                        {attendanceDetail.sunday_sandwich_warning}
                      </p>
                      
                      <div className="bg-gray-800 border border-red-500 rounded-lg p-4">
                        <h4 className="text-red-300 font-semibold mb-3 flex items-center gap-2">
                          <span>📊</span>
                          <span>Week Summary (Current Week)</span>
                        </h4>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          <div className="text-center">
                            <div className="text-gray-400 text-sm">Total Days</div>
                            <div className="text-white text-2xl font-bold">{attendanceDetail.week_working_days?.total || 6}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-400 text-sm">Present</div>
                            <div className="text-green-400 text-2xl font-bold">{attendanceDetail.week_working_days?.present || 0}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-400 text-sm">Absent</div>
                            <div className="text-red-400 text-2xl font-bold">{attendanceDetail.week_working_days?.absent || 0}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-400 text-sm">Required</div>
                            <div className="text-yellow-400 text-2xl font-bold">5</div>
                          </div>
                        </div>
                        
                        {/* Week Calendar Visual */}
                        <div className="flex justify-between items-center gap-2">
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                            const dayStatus = attendanceDetail.week_status?.[idx] || 'unknown'
                            return (
                              <div key={day} className="flex-1 text-center">
                                <div className={`rounded-lg p-2 ${
                                  dayStatus === 'present' ? 'bg-green-600' :
                                  dayStatus === 'absent' ? 'bg-red-600' :
                                  dayStatus === 'leave' ? 'bg-blue-600' :
                                  'bg-gray-700'
                                }`}>
                                  <div className="text-xs text-white font-semibold">{day}</div>
                                  <div className="text-xl mt-1">
                                    {dayStatus === 'present' ? '✅' :
                                     dayStatus === 'absent' ? '❌' :
                                     dayStatus === 'leave' ? '🏖️' : '❓'}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      
                      <div className="mt-3 bg-red-900/40 border border-red-600 rounded p-3">
                        <h4 className="text-red-300 font-bold mb-2">📋 Rule Explanation:</h4>
                        <ul className="text-gray-200 text-sm space-y-1 list-disc list-inside">
                          <li>If you work less than <strong>5 days</strong> in a week (Mon-Sat)</li>
                          <li>Then the <strong>Sunday between that week</strong> will be marked as <strong>Absent (-1)</strong></li>
                          <li>This is called the <strong>"Sunday Sandwich Rule"</strong></li>
                          <li>Make sure to work at least 5 days to keep Sunday as a holiday!</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Pending Leave Auto-Conversion Alert */}
              {attendanceDetail?.pending_leave_alert && (
                <div className="bg-gradient-to-r from-orange-700/20 to-red-700/20 border-2 border-orange-500 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <div className="text-orange-400 text-3xl">⏳</div>
                    <div className="flex-1">
                      <h3 className="font-bold text-orange-400 text-lg mb-2">PENDING LEAVE AUTO-CONVERSION ALERT</h3>
                      <p className="text-gray-200 mb-3">
                        {attendanceDetail.pending_leave_alert}
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Pending Leave Info */}
                        <div className="bg-gray-800 border border-orange-500 rounded-lg p-4">
                          <h4 className="text-orange-300 font-semibold mb-3 flex items-center gap-2">
                            <span>📝</span>
                            <span>Pending Leave Details</span>
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Leave Type:</span>
                              <span className="text-orange-400 font-semibold">{attendanceDetail.pending_leave_type || 'Sick Leave'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Applied On:</span>
                              <span className="text-cyan-400">{attendanceDetail.pending_leave_date || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Pending Since:</span>
                              <span className="text-yellow-400 font-bold">{attendanceDetail.pending_days || 0} days</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Auto-convert After:</span>
                              <span className="text-red-400 font-bold">3 days</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Countdown Timer */}
                        <div className="bg-gray-800 border border-red-500 rounded-lg p-4">
                          <h4 className="text-red-300 font-semibold mb-3 flex items-center gap-2">
                            <span>⏰</span>
                            <span>Time Remaining</span>
                          </h4>
                          <div className="text-center">
                            <div className="text-5xl font-bold text-red-400 mb-2">
                              {Math.max(0, 3 - (attendanceDetail.pending_days || 0))}
                            </div>
                            <div className="text-gray-400 text-sm mb-3">Days until auto-convert to Absconding</div>
                            
                            {/* Progress Bar */}
                            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-yellow-500 to-red-500 transition-all duration-300"
                                style={{ width: `${Math.min(((attendanceDetail.pending_days || 0) / 3) * 100, 100)}%` }}
                              ></div>
                            </div>
                            
                            {(attendanceDetail.pending_days || 0) >= 3 && (
                              <div className="mt-3 text-red-400 font-bold text-sm">
                                ⚠️ Will be auto-converted soon!
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 bg-orange-900/40 border border-orange-600 rounded p-3">
                        <h4 className="text-orange-300 font-bold mb-2">⚡ Action Required:</h4>
                        <p className="text-gray-200 text-sm">
                          If your pending leave is <strong>not approved within 3 days</strong>, it will be 
                          <strong className="text-red-400"> automatically converted to Absconding (AB = -1)</strong>.
                          Please contact your reporting manager to approve the leave immediately.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* No Alerts - All Good */}
              {!attendanceDetail?.sunday_sandwich_warning && !attendanceDetail?.pending_leave_alert && (
                <div className="bg-gradient-to-r from-green-700/20 to-teal-700/20 border-2 border-green-500 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="text-green-400 text-2xl">✅</div>
                    <div>
                      <h3 className="font-bold text-green-400">All Clear!</h3>
                      <p className="text-gray-300 text-sm">No pending alerts or warnings for this date.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual Override Section - Enhanced with all new features */}
          {attendanceDetail?.type !== 'leave' && hasEditPermission() && (
            <div className="mt-6 bg-gradient-to-r from-purple-700/20 to-pink-700/20 border-2 border-purple-500 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="text-purple-400 text-2xl">✏️</div>
                <div>
                  <h3 className="font-bold text-purple-400 text-lg">MANUAL OVERRIDE BY HR/ADMIN</h3>
                  <p className="text-gray-300 text-sm">Manually update attendance status. Comment is mandatory.</p>
                </div>
              </div>
              
              <div className="space-y-4">
                {/* Current Status Display */}
                <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Current Status:</span>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(currentStatus)}
                      <span className="text-gray-200 font-semibold">{getStatusText(currentStatus)}</span>
                    </div>
                  </div>
                  {attendanceDetail?.working_hours && (
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-gray-400">Working Hours:</span>
                      <span className="text-cyan-400 font-semibold">{attendanceDetail.working_hours} hrs</span>
                    </div>
                  )}
                </div>
                
                {/* New Status Selection */}
                <div>
                  <label className="block text-gray-200 font-semibold mb-2">
                    SELECT NEW STATUS: <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={selectedAttendance}
                    onChange={(e) => setSelectedAttendance(e.target.value)}
                    className="w-full p-3 border-2 border-gray-600 rounded-lg bg-gray-800 text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">-- Select New Attendance Status --</option>
                    <optgroup label="✅ Positive Status">
                      <option value="P">P - Present (Full Day = 1)</option>
                      <option value="HD">HD - Half Day (0.5)</option>
                    </optgroup>
                    <optgroup label="⚠️ Late / Leave">
                      <option value="L">L - Late (Check working hours)</option>
                      <option value="LV">LV - Leave Approved (0)</option>
                      <option value="PL">PL - Pending Leave (0)</option>
                    </optgroup>
                    <optgroup label="🔴 Negative Status">
                      <option value="AB">AB - Absconding (-1)</option>
                      <option value="ISS">ISS - Issue (Missing Punch)</option>
                      <option value="Z">Z - Zero (Insufficient Hours)</option>
                    </optgroup>
                    <optgroup label="🔵 Holiday">
                      <option value="H">H - Holiday (0)</option>
                    </optgroup>
                  </select>
                  {selectedAttendance && (
                    <div className="mt-2 text-sm">
                      <span className="text-gray-400">Attendance Count: </span>
                      <span className={`font-bold ${getAttendanceCount(selectedAttendance) >= 1 ? 'text-green-400' : getAttendanceCount(selectedAttendance) === 0.5 ? 'text-yellow-400' : getAttendanceCount(selectedAttendance) < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {getAttendanceCount(selectedAttendance)}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Mandatory Comment Field */}
                <div>
                  <label className="block text-gray-200 font-semibold mb-2">
                    REASON / COMMENT: <span className="text-red-400">* (Mandatory)</span>
                  </label>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Enter reason for manual override (mandatory)..."
                    rows={3}
                    className="w-full p-3 border-2 border-gray-600 rounded-lg bg-gray-800 text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    ⚠️ This comment will be saved in history with your name and timestamp.
                  </p>
                </div>
                
                {/* Validation Warning */}
                {selectedAttendance && !newComment.trim() && (
                  <div className="bg-red-900/30 border border-red-500 rounded-lg p-3">
                    <p className="text-red-400 text-sm font-semibold">⚠️ Comment is mandatory for manual override!</p>
                  </div>
                )}
                
                {/* Update Button - Disabled if comment empty */}
                <button 
                  onClick={handleUpdate} 
                  disabled={!selectedAttendance || !newComment.trim() || loading}
                  className={`w-full py-3 rounded-lg font-bold text-white transition-all duration-200 ${
                    !selectedAttendance || !newComment.trim() || loading
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {loading ? '⏳ UPDATING...' : '✅ UPDATE ATTENDANCE (MANUAL OVERRIDE)'}
                </button>
              </div>
            </div>
          )}

          {/* Leave Notice for Leave Records */}
          {attendanceDetail?.type === 'leave' && (
            <div className="mt-6 bg-gradient-to-r from-orange-700/20 to-yellow-700/20 border border-orange-500 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="text-orange-400 text-2xl">🏖️</div>
                <div>
                  <h4 className="font-semibold text-orange-400">Employee is on Leave</h4>
                  <p className="text-gray-300 text-sm">This is an approved leave record. Attendance cannot be modified for leave days.</p>
                </div>
              </div>
            </div>
          )}

          {/* Permission Notice for Users without Edit Access */}
          {attendanceDetail?.type !== 'leave' && !hasEditPermission() && (
            <div className="mt-6 bg-gradient-to-r from-red-700/20 to-pink-700/20 border border-red-500 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="text-red-400 text-2xl">🚫</div>
                <div>
                  <h4 className="font-semibold text-red-400">No Edit Permission</h4>
                  <p className="text-gray-300 text-sm">
                    {getPermissionLevel('attendance') === 'own' 
                      ? "Regular employees cannot edit attendance records. Only managers and administrators can modify attendance data."
                      : "You don't have permission to edit this attendance record. Contact your administrator for access."
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            {attendanceDetail?.type !== 'leave' && hasEditPermission() && (
              <button 
                onClick={handleUpdate} 
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-6 py-2 w-full rounded-md transition-all duration-200 font-semibold"
              >
                UPDATE ATTENDANCE
              </button>
            )}
            <button 
              onClick={onClose} 
              className={`bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-2 w-full rounded-md transition-all duration-200 font-semibold ${(attendanceDetail?.type === 'leave' || !hasEditPermission()) ? 'col-span-2' : ''}`}
            >
              CLOSE
            </button>
          </div>

          {/* Additional Buttons */}
          <div className="flex gap-4 mt-4">
            <button className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-2 rounded-md transition-all duration-200 font-semibold">
              {attendanceDetail?.type === 'leave' ? '💬 ADD COMMENTS' : '🏠 ADD COMMENTS'}
            </button>
            <button
              onClick={handleShowHistory}
              className="border border-gray-500 text-gray-300 px-6 py-2 bg-gray-800 rounded-md hover:bg-gray-700 transition-all duration-200 font-semibold"
            >
              👤 HISTORY
            </button>
          </div>

          {/* Comments Section - Always Visible */}
          <div className="mt-6 border-t border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Comments</h3>

            {/* Add Comment Box - Single Row with Send Button */}
            <div className="bg-gray-800 border border-gray-600 p-4 rounded-lg mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-6 w-6 text-gray-300" />
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add your comment here..."
                    className="flex-1 p-3 border border-gray-600 rounded-lg bg-gray-700 text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    onKeyPress={(e) => e.key === "Enter" && handleSendComment()}
                  />
                  <button
                    onClick={handleSendComment}
                    disabled={loading}
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 text-white px-4 py-3 flex items-center gap-2 flex-shrink-0 rounded-md transition-all duration-200 font-semibold"
                  >
                    <Send className="h-4 w-4" />
                    {loading ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-4 max-h-60 overflow-y-auto">
              {comments.length > 0 ? (
                comments.map((comment, index) => (
                  <div key={comment._id || index} className="flex items-start gap-3 p-4 bg-gray-800 border border-gray-600 rounded-lg">
                    <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="h-6 w-6 text-gray-300" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-cyan-400">{comment.user_name || comment.user || 'Unknown User'}</span>
                        <span className="text-sm text-gray-400">{comment.created_at ? formatDateTime(comment.created_at) : comment.timestamp}</span>
                      </div>
                      <p className="text-gray-200">{comment.content || comment.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">No comments yet. Be the first to add one!</p>
                </div>
              )}
            </div>
          </div>

          {/* History Section */}
          {showHistory && (
            <div className="mt-6 border-t border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-200 mb-4">History</h3>

              {/* History Table */}
              <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-600">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-700 text-cyan-400">
                      <th className="border border-gray-600 px-4 py-3 text-left font-semibold">#</th>
                      <th className="border border-gray-600 px-4 py-3 text-left font-semibold">DATE</th>
                      <th className="border border-gray-600 px-4 py-3 text-left font-semibold">CREATED BY</th>
                      <th className="border border-gray-600 px-4 py-3 text-left font-semibold">CHANGES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record, index) => (
                      <tr key={record._id || index} className={index % 2 === 0 ? "bg-gray-800" : "bg-gray-750"}>
                        <td className="border border-gray-600 px-4 py-3 text-gray-200">{index + 1}</td>
                        <td className="border border-gray-600 px-4 py-3 text-gray-200">{formatDateTime(record.changed_at)}</td>
                        <td className="border border-gray-600 px-4 py-3 text-gray-200">{record.changed_by_name || 'Unknown'}</td>
                        <td className="border border-gray-600 px-4 py-3 text-gray-200">
                          {record.action} - {record.old_value !== undefined ? `${record.old_value} → ${record.new_value}` : record.new_value}
                        </td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td colSpan="4" className="border border-gray-600 px-4 py-3 text-gray-400 text-center">
                          No history available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const calculateMonthlyStats = (record, selectedYear, selectedMonth, daysInMonth, holidays) => {
  let present = 0,
    late = 0,
    leave = 0,
    halfDay = 0,
    absconding = 0,
    holidaysCount = 0

  for (let day = 1; day <= daysInMonth; day++) {
    const status = record[`day${day}`]
    switch (status) {
      case "P":
        present++
        break
      case "L":
        late++
        break
      case "LV":
        leave++
        break
      case "H":
        holidaysCount++
        break
      case "HD":
        halfDay++
        break
      case "AB":
        absconding++
        break
    }
  }

  const workingDays = daysInMonth - holidaysCount
  const attendancePercentage = workingDays > 0 ? (((present + late + halfDay) / workingDays) * 100).toFixed(1) : "0"

  return {
    present,
    late,
    leave,
    halfDay,
    absconding,
    holidays: holidaysCount,
    workingDays,
    attendancePercentage,
  }
}

export default function MonthlyAttendanceTable() {
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
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
  const [activeTab, setActiveTab] = useState('calendar') // 'calendar' or 'face-registration'

  // Table horizontal scroll controls
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
  
  // Permission check functions  
  const canUserViewAll = () => canViewAll('attendance');
  const canUserViewJunior = () => canViewJunior('attendance');
  const canUserCreate = () => canCreate('attendance');
  const canUserEdit = (recordOwnerId) => {
    // For attendance, regular users (own only) should NOT be able to edit even their own records
    const level = getPermissionLevel('attendance');
    if (level === 'own') {
      return false; // Regular users cannot edit attendance records
    }
    return canEdit('attendance', recordOwnerId);
  };
  const canUserDelete = (recordOwnerId) => canDelete('attendance', recordOwnerId);

  // Legacy compatibility functions
  const isAdmin = () => canUserViewAll();
  const hasAdminPermissions = () => canUserViewAll();
  
  // Legacy compatibility for the old canViewAll function
  const canViewAllRecords = () => canUserViewAll();

  // Convert API response to calendar format
  const convertToCalendarFormat = (apiData) => {
    if (!apiData?.employees?.length) {
      return [];
    }

    return apiData.employees.map(employee => {
      // Create a record for each employee with day status mapping
      const employeeRecord = {
        id: employee.employee_id,
        name: employee.employee_name,
        employeeId: employee.employee_code || employee.employee_number || employee.empId || `EMP-${employee.employee_id?.slice(-6) || 'UNKNOWN'}`,
        department: employee.department_name || "Unknown Department",
        role: employee.role_name || "",
        photo: employee.employee_photo
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
            } else if (status === 1.0 || status === 1) {
              employeeRecord[dayKey] = 'P'; // Present/Full Day
            } else if (status === 0.5) {
              employeeRecord[dayKey] = 'HD'; // Half Day (different from holiday)
            } else if (status === 0 || status === 0.0) {
              employeeRecord[dayKey] = 'LV'; // Leave (using LV to differentiate from Late)
            } else if (status === -1 || status === -1.0) {
              employeeRecord[dayKey] = ''; // Formerly Absent - now empty
            } else if (status === -2 || status === -2.0) {
              employeeRecord[dayKey] = 'AB'; // Absconding
            } else if (day.status === "L") {
              employeeRecord[dayKey] = 'L'; // Late
            } else {
              employeeRecord[dayKey] = ''; // Default empty
            }
          } else if (day.is_weekend) {
            employeeRecord[dayKey] = 'W'; // Weekend
          } else if (day.is_holiday) {
            employeeRecord[dayKey] = 'H'; // Holiday (fallback check)
          } else {
            employeeRecord[dayKey] = ''; // Default empty for no status
          }
        });      return employeeRecord;
    });
  };

  // Fetch attendance data when component mounts or month changes
  useEffect(() => {
    const fetchAttendanceData = async () => {
      if (!user?.user_id) return
      
      setLoading(true)
      setError(null)
      
      try {
        const response = await attendanceAPI.getCalendar(selectedYear, selectedMonth, user.user_id)
        
        console.log('API Response:', response)
        
        if (response && response.employees) {
          const formattedData = convertToCalendarFormat(response)
          console.log('Formatted data:', formattedData)
          setAttendanceData(formattedData)
        } else {
          setAttendanceData([])
        }
      } catch (error) {
        console.error('Error fetching attendance data:', error)
        setError('Failed to load attendance data. Please try again.')
        setAttendanceData([])
      } finally {
        setLoading(false)
      }
    }

    fetchAttendanceData()
  }, [selectedYear, selectedMonth, user])

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()

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
    setSelectedEmployee(employee)
    setSelectedDate(1) // Default to first day
    setModalOpen(true)
  }

  const handleDayClick = async (employee, day) => {
    if (!user?.user_id) return
    
    setSelectedEmployee(employee)
    setSelectedDate(day)
    setModalOpen(true)
    setLoading(true)
    
    // Fetch detailed attendance data for this day
    try {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      
      // Fetch attendance detail
      const detailData = await attendanceAPI.getAttendanceDetail(employee.id, dateStr, user.user_id)
      
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
        const historyData = await attendanceAPI.getHistory(employee.id, dateStr, user.user_id)
        setHistory(historyData.history || [])
      } catch (error) {
        console.error('Error fetching history:', error)
        setHistory([])
      }
      
      // Store detail data in employee object for modal display
      setSelectedEmployee({
        ...employee,
        attendanceDetail: detailData
      })
    } catch (error) {
      console.error('Error fetching attendance detail:', error)
    }
    
    setLoading(false)
    setSelectedDate(day)
    setModalOpen(true)
  }

  const handleUpdateAttendance = (employeeId, day, newStatus) => {
    setAttendanceData((prevData) =>
      prevData.map((employee) => (employee.id === employeeId ? { ...employee, [`day${day}`]: newStatus } : employee)),
    )
  }

  const handleUpdateHolidays = async (newHolidays) => {
    setHolidays(newHolidays)
    // The holidays are now managed via API calls in the modal
    // This function just updates the local state for immediate UI updates
    console.log('Updated holidays:', newHolidays)
    
    // Optionally refresh attendance data to reflect holiday changes
    if (user?.user_id && (permissions !== null || isAdmin())) {
      try {
        const response = await attendanceAPI.getCalendar(selectedYear, selectedMonth, user.user_id)
        if (response && response.employees) {
          let formattedData = convertToCalendarFormat(response)
          
          // Filter data based on user permissions
          if (!canViewAllRecords()) {
            formattedData = formattedData.filter(employee => employee.id === user.user_id)
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

  if (loading || (user && permissions === null && !isAdmin())) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-8 w-8 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
          </svg>
          <span className="text-white text-lg">
            {permissions === null ? 'Loading permissions...' : 'Loading attendance data...'}
          </span>
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="flex flex-col items-center">
          <span className="text-red-500 text-lg mb-2">{error}</span>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="w-full p-6 space-y-6 bg-black min-h-screen">
      {/* Tab Navigation */}
      <div className="bg-black rounded-lg border border-gray-800 overflow-hidden">
        <div className="flex gap-0">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'calendar'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                : 'bg-black text-gray-400 hover:text-white hover:bg-gray-900'
            }`}
          >
            <Calendar className="h-4 w-4" />
            Attendance Calendar
          </button>
          {user?.is_super_admin && (
            <button
              onClick={() => setActiveTab('face-registration')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'face-registration'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'bg-black text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              <Users2 className="h-4 w-4" />
              Face Registration
            </button>
          )}
        </div>
      </div>

      {/* Face Registration View */}
      {activeTab === 'face-registration' && (
        <FaceRegistration />
      )}

      {/* Attendance Calendar View */}
      {activeTab === 'calendar' && (
      <>
      {/* Header */}
      <div className="bg-black rounded-lg p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div></div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateMonth("prev")}
                className="border border-gray-600 bg-black text-white hover:bg-gray-800 px-3 py-2 rounded-md transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 min-w-[200px] justify-center">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="font-semibold text-lg text-white">
                  {months[selectedMonth - 1]} {selectedYear}
                </span>
              </div>
              <button
                onClick={() => navigateMonth("next")}
                className="border border-gray-600 bg-black text-white hover:bg-gray-800 px-3 py-2 rounded-md transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {canViewAllRecords() && (
              <button
                onClick={() => setHolidayModalOpen(true)}
                className="border border-gray-600 bg-black text-white hover:bg-gray-800 px-3 py-2 rounded-md transition-colors flex items-center gap-2"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Holidays
              </button>
            )}

            <button
              onClick={() => exportToPDF(attendanceData, selectedYear, selectedMonth, holidays)}
              className="border border-gray-600 bg-black text-white hover:bg-gray-800 px-3 py-2 rounded-md transition-colors flex items-center gap-2"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-black rounded-lg p-4 ">
        <div className="flex flex-wrap gap-6 items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-500 rounded"></div>
            <span className="text-sm font-medium text-white">Present (P)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-yellow-500 to-orange-500 rounded"></div>
            <span className="text-sm font-medium text-white">Late (L)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-500 rounded"></div>
            <span className="text-sm font-medium text-white">Leave (LV)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 rounded"></div>
            <span className="text-sm font-medium text-white">Holiday (H)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-yellow-500 rounded"></div>
            <span className="text-sm font-medium text-white">Half Day (HD)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-red-500 rounded"></div>
            <span className="text-sm font-medium text-white">Absconding (AB)</span>
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-black rounded-lg p-6 border border-gray-700">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400">
              {attendanceData.reduce(
                (acc, record) =>
                  acc + calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays).present,
                0,
              )}
            </div>
            <div className="text-sm text-gray-300 mt-1">Total Present Days</div>
          </div>
        </div>
        <div className="bg-black rounded-lg p-6 border border-gray-700">
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400">
              {attendanceData.reduce(
                (acc, record) =>
                  acc + calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays).late,
                0,
              )}
            </div>
            <div className="text-sm text-gray-300 mt-1">Total Late Days</div>
          </div>
        </div>
        <div className="bg-black rounded-lg p-6 border border-gray-700">
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-400">
              {attendanceData.reduce(
                (acc, record) =>
                  acc + calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays).leave,
                0,
              )}
            </div>
            <div className="text-sm text-gray-300 mt-1">Total Leave Days</div>
          </div>
        </div>
        <div className="bg-black rounded-lg p-6 border border-gray-700">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-400">
              {(
                attendanceData.reduce((acc, record) => {
                  const stats = calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays)
                  return acc + Number.parseFloat(stats.attendancePercentage)
                }, 0) / attendanceData.length
              ).toFixed(1)}
              %
            </div>
            <div className="text-sm text-gray-300 mt-1">Average Attendance</div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-black rounded-lg overflow-hidden shadow-2xl">
        <div className="relative">
          {/* Horizontal scroll buttons */}
          {/* Left scroll button - temporarily always show for testing */}
          <button
            onClick={() => scrollTable('left')}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white p-4 rounded-full shadow-lg transition-all duration-200 opacity-80 hover:opacity-100"
            style={{ 
              backgroundColor: 'rgba(37, 99, 235, 1)',
              zIndex: 9999
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(29, 78, 216, 1)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(37, 99, 235, 1)'}
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-9 h-9" />
          </button>
          
          {/* Right scroll button - temporarily always show for testing */}
          <button
            onClick={() => scrollTable('right')}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white p-4 rounded-full shadow-lg transition-all duration-200 opacity-80 hover:opacity-100"
            style={{ 
              backgroundColor: 'rgba(37, 99, 235, 1)',
              zIndex: 9999
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(29, 78, 216, 1)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(37, 99, 235, 1)'}
            aria-label="Scroll right"
          >
            <ChevronRight className="w-9 h-9" />
          </button>
          
          <div 
            ref={tableScrollRef}
            className="overflow-x-auto"
            onScroll={updateScrollButtons}
          >
            <table className="w-full bg-black border-collapse border border-gray-700" style={{ minWidth: '1200px' }}>
            <thead style={{backgroundColor: '#03b0f5'}}>
              <tr>
                <th className="sticky left-0 px-4 py-1 text-left font-bold text-white min-w-[200px] border border-gray-300" style={{backgroundColor: '#03b0f5'}}>
                  Employee Details
                </th>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                  <th key={day} className="px-3 py-1 text-center font-bold text-white min-w-[50px] border border-gray-300">
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-bold">{day}</span>
                      <span className="text-xs text-blue-100 opacity-80">{getDayName(selectedYear, selectedMonth, day)}</span>
                    </div>
                  </th>
                ))}
                <th className="px-4 py-1 text-center font-bold text-white border border-gray-300 min-w-[140px]">
                  Summary
                </th>
              </tr>
            </thead>
            <tbody className="bg-black">
              {attendanceData.map((record, index) => {
                const stats = calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays)
                const isEvenRow = index % 2 === 0
                return (
                  <tr
                    key={record.id}
                    className="bg-black hover:bg-gray-800 transition-colors border-b border-gray-700"
                  >
                    <td
                      className="sticky left-0 bg-black px-4 py-5 border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors"
                      onClick={() => handleEmployeeClick(record)}
                    >
                      <div className="space-y-2">
                        <div className="font-semibold text-white text-base">{record.name}</div>
                        <div className="text-sm text-blue-300 font-medium">{record.employeeId}</div>
                        <div className="text-sm text-gray-400">{record.department}</div>
                      </div>
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                      <td
                        key={day}
                        className="px-2 py-2 text-center cursor-pointer hover:bg-gray-700 border border-gray-600 transition-colors"
                        onClick={() => handleDayClick(record, day)}
                      >
                        {getStatusBadge(record[`day${day}`])}
                      </td>
                    ))}
                    <td className="px-4 py-3 border border-gray-600">
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Present:</span>
                          <span className="font-bold text-green-400">{stats.present}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Late:</span>
                          <span className="font-bold text-yellow-400">{stats.late}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Leave:</span>
                          <span className="font-bold text-orange-400">{stats.leave}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300">Half Day:</span>
                          <span className="font-bold text-cyan-400">{stats.halfDay}</span>
                        </div>
                        {stats.holidays > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Holidays:</span>
                            <span className="font-bold text-blue-400">{stats.holidays}</span>
                          </div>
                        )}
                        {stats.absconding > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300">Absconding:</span>
                            <span className="font-bold text-red-400">{stats.absconding}</span>
                          </div>
                        )}
                        <div className="border-t border-gray-600 pt-1 mt-2">
                          <div className="flex justify-between items-center font-semibold">
                            <span className="text-gray-300">Attendance:</span>
                            <span
                              className={`${Number.parseFloat(stats.attendancePercentage) >= 90 ? "text-green-400" : Number.parseFloat(stats.attendancePercentage) >= 75 ? "text-yellow-400" : "text-red-400"}`}
                            >
                              {stats.attendancePercentage}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
      </>
      )}
