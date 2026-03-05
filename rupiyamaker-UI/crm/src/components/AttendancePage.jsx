"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronLeft, ChevronRight, Download, Calendar, X, Frown, User, Send, Plus, Trash2, History } from "lucide-react"
import axios from "axios"
import { formatDateTime } from '../utils/dateUtils';
import hrmsService from '../services/hrmsService';
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
  isSuperAdmin,
  getUserPermissions
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

const getStatusBadge = (status, leaveStatus = null) => {
  // If there's a pending leave request, show "0" with white background and black text
  if (leaveStatus === 'pending') {
    return (
      <div className="w-8 h-8 bg-gray-200 text-gray-800 rounded-xl flex items-center justify-center text-xs font-bold border border-gray-400">
        0
      </div>
    )
  }
  
  // If leave was rejected, show as absconding
  if (leaveStatus === 'rejected') {
    return (
      <div className="w-8 h-8 bg-rose-500 text-white rounded-xl flex items-center justify-center text-xs font-bold">
        -1
      </div>
    )
  }
  
  switch (status) {
    case "P":
      return (
        <div className="w-8 h-8 bg-emerald-500 text-white rounded-xl flex items-center justify-center text-xs font-bold">
          1
        </div>
      )
    case "L":
      return (
        <div className="w-8 h-8 bg-emerald-500 text-white rounded-xl flex items-center justify-center text-xs font-bold">
          1
        </div>
      )
    case "LV":
      return (
        <div className="w-8 h-8 bg-orange-500 text-white rounded-xl flex items-center justify-center text-xs font-bold">
          0
        </div>
      )
    case "H":
      return (
        <div className="w-8 h-8 bg-cyan-500 text-white rounded-xl flex items-center justify-center text-xs font-bold">
          1
        </div>
      )
    case "SP":
      // Sunday Paid — employee worked full week, Sunday is paid (+1, blue like Holiday)
      return (
        <div className="w-8 h-8 bg-blue-500 text-white rounded-xl flex items-center justify-center text-xs font-bold">
          1
        </div>
      )
    case "S0":
      // Sunday Zero — Monday absconding, so Sunday is 0 (dark gray)
      return (
        <div className="w-8 h-8 bg-gray-600 text-gray-300 rounded-xl flex items-center justify-center text-xs font-bold">
          0
        </div>
      )
    case "HD":
      return (
        <div className="w-8 h-8 bg-amber-400 text-white rounded-xl flex items-center justify-center text-xs font-bold">
          0.5
        </div>
      )
    case "AB":
      return (
        <div className="w-8 h-8 bg-rose-500 text-white rounded-xl flex items-center justify-center text-xs font-bold">
          -1
        </div>
      )
    case "A":
      return (
        <div className="w-8 h-8 bg-rose-500 text-white rounded-xl flex items-center justify-center text-xs font-bold">
          -1
        </div>
      )
    case "W":
      return <div className="w-8 h-8 bg-[#1c1c1e] rounded-xl flex items-center justify-center text-xs text-gray-600">—</div>
    default:
      return <div className="w-8 h-8 bg-[#111] rounded-xl flex items-center justify-center text-xs text-gray-700"></div>
  }
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
          <span class="legend-color" style="background-color: #f97316;"></span>LV = Leave
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-4 rounded-t-lg relative sticky top-0 z-10">
          <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors">
            <X className="h-6 w-6" />
          </button>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            Attendance Edit History
          </h2>
          {employee && (
            <p className="text-amber-100 text-sm mt-1">
              {employee.name} — {displayEntries.length} edit{displayEntries.length !== 1 ? 's' : ''} this month
            </p>
          )}
        </div>

        <div className="p-5 bg-gray-900 space-y-4">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
            </div>
          ) : displayEntries.length > 0 ? (
            displayEntries.map((entry, index) => {
              const attendanceDate = entry.date ? new Date(entry.date + 'T00:00:00') : null
              const editedAt = new Date(entry.created_at || entry.changed_at || entry.timestamp)
              const editorName = entry.created_by_name || entry.changed_by_name || entry.editor_name || 'System'
              const reason = entry.reason || entry.details?.reason
              const isSummary = entry.action_type === 'attendance_edited'
              const isCreated = entry.action_type === 'attendance_created'

              // Parse changes from details.changes array (for summary entries)
              const parsedChanges = []
              if (isSummary && Array.isArray(entry.details?.changes)) {
                entry.details.changes.forEach(line => {
                  const { field, oldVal, newVal } = parseChangeLine(line)
                  parsedChanges.push({ field, oldVal, newVal })
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

              return (
                <div key={index} className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-amber-500/40 transition-colors">
                  {/* Top row: attendance date + who + when */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {/* Attendance date (the day that was edited) */}
                      {attendanceDate && (
                        <span className="bg-amber-900/30 border border-amber-700 text-amber-300 text-xs font-bold px-3 py-1 rounded-full">
                          📅 {attendanceDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}
                        </span>
                      )}
                      {isCreated && (
                        <span className="bg-blue-900/30 border border-blue-700 text-blue-300 text-xs font-semibold px-2 py-1 rounded-full">Created</span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {/* Editor name */}
                      <span className="flex items-center gap-1 bg-purple-900/30 border border-purple-700 text-purple-300 text-xs font-semibold px-3 py-1 rounded-full">
                        <User className="h-3 w-3" /> {editorName}
                      </span>
                      {/* Edit timestamp */}
                      <span className="text-gray-500 text-xs">
                        🕐 {editedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                  </div>

                  {/* Changes */}
                  {parsedChanges.length > 0 && (
                    <div className="space-y-2">
                      {parsedChanges.map((ch, ci) => {
                        const fieldLabel = ch.field
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, l => l.toUpperCase())
                        const isStatusField = ch.field === 'status'
                        const oldInfo = isStatusField ? numericStatusLabel(ch.oldVal) : null
                        const newInfo = isStatusField ? numericStatusLabel(ch.newVal) : null
                        return (
                          <div key={ci} className="flex flex-wrap items-center gap-2 bg-gray-700/40 rounded-lg px-3 py-2">
                            <span className="text-gray-400 text-xs font-medium w-24 shrink-0">{fieldLabel}</span>
                            {ch.oldVal !== null && ch.oldVal !== 'None' && ch.oldVal !== '' ? (
                              <>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${isStatusField ? oldInfo.color : 'bg-gray-600 border-gray-500 text-gray-200'}`}>
                                  {isStatusField ? oldInfo.label : ch.oldVal}
                                </span>
                                <span className="text-gray-500 font-bold">→</span>
                              </>
                            ) : null}
                            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${isStatusField ? newInfo.color : 'bg-gray-600 border-gray-500 text-gray-200'}`}>
                              {isStatusField ? newInfo.label : ch.newVal}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Reason */}
                  {reason && (
                    <div className="mt-2 bg-gray-700/40 rounded-lg px-3 py-2 text-sm">
                      <span className="text-gray-400 text-xs">Reason: </span>
                      <span className="text-gray-200">{reason}</span>
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="text-center py-12">
              <History className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No edit history found for this month</p>
              <p className="text-gray-500 text-sm mt-2">No attendance edits have been recorded yet</p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button onClick={onClose} className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-2 rounded-md transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
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

  return (
    <div className="fixed inset-0 bg-transparent bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
    </div>
  )
}

// Employee Detail Modal Component
const EmployeeDetailModal = ({ employee, selectedDate, isOpen, onClose, onUpdate, selectedYear, selectedMonth, canUserEdit }) => {
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

  // Load attendance detail when modal opens
  useEffect(() => {
    if (isOpen && employee && selectedDate && user?.user_id) {
      loadAttendanceDetail()
    }
  }, [isOpen, employee, selectedDate, user])

  // Check edit permissions using the imported permission functions
  const hasEditPermission = () => {
    if (!employee?.id) return false;
    
    // Get user permissions from localStorage
    const userPermissions = getUserPermissions();
    
    // Superadmin with wildcard (*) can always edit attendance
    if (isSuperAdmin(userPermissions)) {
      return true;
    }
    
    // STRICT CHECK: User must have explicit 'update' action in attendance permissions
    // 'all' permission does NOT grant update access
    if (Array.isArray(userPermissions)) {
      const attendancePerm = userPermissions.find(p => p.page === 'attendance');
      if (attendancePerm && Array.isArray(attendancePerm.actions)) {
        // Only return true if 'update' is explicitly in the actions array
        return attendancePerm.actions.includes('update');
      }
    }
    
    return false; // No update permission found
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
      alert('Please provide a reason for this update')
      return
    }

    if (!selectedAttendance || !user?.user_id) return
    
    console.log('🔄 [UPDATE] Starting attendance update')
    console.log('📝 [UPDATE] Reason:', updateReason.trim())
    console.log('👤 [UPDATE] Employee:', employee.id, employee.name)
    console.log('📅 [UPDATE] Date:', selectedDate, 'Status:', selectedAttendance)
    
    setLoading(true)
    setShowReasonModal(false)
    
    try {
      // Convert status to backend format
      let statusValue
      switch (selectedAttendance) {
        case "P": statusValue = 1; break
        case "HD": statusValue = 0.5; break
        case "A": statusValue = 0; break
        case "AB": statusValue = -1; break
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
      
      // Clear reason
      setUpdateReason('')
      
      console.log('🎉 [UPDATE] Attendance update completed successfully')
      alert('Attendance updated successfully!')
    } catch (error) {
      console.error('❌ [UPDATE] Error updating attendance:', error)
      alert('Failed to update attendance. Please try again.')
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f0f0f] border border-gray-800 rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-700 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {employee.name?.charAt(0)?.toUpperCase() || 'E'}
            </div>
            <div>
              <h2 className="text-white font-bold text-xl leading-tight uppercase tracking-wide">{employee.name}</h2>
              <p className="text-gray-400 text-sm mt-0.5">
                {employee.employee_code || employee.employeeId || `EMP-${employee.id?.slice(-6) || '???'}`}
                <span className="mx-2 text-gray-600">•</span>
                {employee.department || 'Employee'}
                <span className="mx-2 text-gray-600">•</span>
                <span className="text-blue-400">
                  {selectedDate && new Date(selectedYear, selectedMonth - 1, selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-full text-sm font-semibold transition-colors">
              Daily Record
            </button>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Body (left main + right history) ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: scrollable main content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* ── Loading ── */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p className="text-gray-400 text-sm">Loading attendance details...</p>
              </div>
            )}

            {!loading && attendanceDetail?.type === 'leave' && (
              /* ── Leave mode ── */
              <div className="space-y-4">
                <div className="bg-[#1a1a1a] border border-orange-500/40 rounded-xl p-5">
                  <p className="text-orange-400 text-xs font-semibold tracking-widest mb-1">LEAVE STATUS</p>
                  <p className="text-yellow-400 font-bold text-2xl uppercase">{attendanceDetail.leave_details?.leave_type_display || 'ON LEAVE'}</p>
                </div>
                {attendanceDetail.leave_details && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-4 space-y-3">
                      <p className="text-gray-500 text-xs font-semibold tracking-widest">LEAVE INFO</p>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Type</span>
                        <span className="text-orange-400 font-semibold text-sm">{attendanceDetail.leave_details.leave_type_display}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Duration</span>
                        <span className="text-green-400 font-semibold text-sm">{attendanceDetail.leave_details.duration_days} day(s)</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Status</span>
                        <span className="text-green-400 font-semibold text-sm uppercase">{attendanceDetail.leave_details.status_display || attendanceDetail.leave_details.status}</span>
                      </div>
                    </div>
                    <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-4 space-y-3">
                      <p className="text-gray-500 text-xs font-semibold tracking-widest">APPROVAL</p>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Approved By</span>
                        <span className="text-purple-400 font-semibold text-sm">{attendanceDetail.leave_details.approved_by_name || '—'}</span>
                      </div>
                      {attendanceDetail.leave_details.reason && (
                        <div>
                          <span className="text-gray-400 text-xs block mb-1">Reason</span>
                          <p className="text-yellow-400 text-sm bg-gray-800 rounded-lg p-2">{attendanceDetail.leave_details.reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {attendanceDetail.leave_details?.attachments && attendanceDetail.leave_details.attachments.length > 0 && (
                  <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-4">
                    <p className="text-gray-500 text-xs font-semibold tracking-widest mb-3">ATTACHMENTS</p>
                    <div className="space-y-2">
                      {attendanceDetail.leave_details.attachments.map((att, i) => (
                        <div key={i} className="flex items-center justify-between bg-[#111] border border-gray-800 rounded-lg p-3">
                          <span className="text-gray-300 text-sm">{att.filename || `Attachment ${i + 1}`}</span>
                          <button onClick={() => window.open(`${BASE_URL}/media/${att.relative_path || att.file_path}`, '_blank')} className="text-indigo-400 hover:text-indigo-300 text-sm underline">View</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl p-4 flex gap-3 items-start">
                  <span className="text-orange-400 text-lg">🏖️</span>
                  <div>
                    <p className="text-orange-400 font-semibold text-sm">Employee is on Leave</p>
                    <p className="text-gray-400 text-xs mt-0.5">Attendance cannot be modified for approved leave days.</p>
                  </div>
                </div>
              </div>
            )}

            {!loading && attendanceDetail?.type !== 'leave' && (
              /* ── Regular attendance mode ── */
              <>
                {/* Status + Hours Row */}
                <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-xs font-semibold tracking-widest mb-1">CURRENT STATUS</p>
                    <p className={`font-bold text-2xl tracking-wide ${
                      (attendanceDetail?.status_text || statusText)?.toUpperCase() === 'PRESENT' ? 'text-green-400' :
                      (attendanceDetail?.status_text || statusText)?.toLowerCase().includes('half') ? 'text-yellow-400' :
                      (attendanceDetail?.status_text || statusText)?.toLowerCase().includes('absent') || (attendanceDetail?.status_text || statusText)?.toLowerCase().includes('absconding') ? 'text-red-400' :
                      'text-blue-400'
                    }`}>{(attendanceDetail?.status_text || statusText || 'NOT MARKED').toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500 text-xs font-semibold tracking-widest mb-1">TOTAL HOURS</p>
                    <p className="text-white font-bold text-2xl font-mono tracking-widest">
                      {attendanceDetail?.attendance_details?.total_working_hours || attendanceDetail?.working_hours || '—'}
                    </p>
                  </div>
                </div>

                {/* Check In / Check Out Cards */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Check In */}
                  <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                      <span className="text-blue-400 font-bold text-xs tracking-widest">CHECK IN</span>
                      <span className="text-gray-300 font-mono text-sm">{attendanceDetail?.check_in_time || attendanceDetail?.attendance_details?.check_in_time || '—'}</span>
                    </div>
                    <div className="flex items-center justify-center bg-[#111] min-h-[200px] relative">
                      {(attendanceDetail?.check_in_photo_path || attendanceDetail?.check_in_photo || attendanceDetail?.attendance_details?.check_in_photo_path) ? (
                        <img
                          src={`${BASE_URL}/${attendanceDetail.check_in_photo_path || attendanceDetail.check_in_photo || attendanceDetail.attendance_details.check_in_photo_path}`}
                          alt="Check-in"
                          className="w-full object-cover max-h-[220px]"
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                      ) : null}
                      <div className={`flex-col items-center justify-center gap-2 text-center p-6 ${(attendanceDetail?.check_in_photo_path || attendanceDetail?.check_in_photo || attendanceDetail?.attendance_details?.check_in_photo_path) ? 'hidden' : 'flex'}`}>
                        <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center">
                          <Frown className="w-7 h-7 text-gray-500" />
                        </div>
                        <p className="text-gray-500 text-xs">No photo</p>
                      </div>
                    </div>
                    {(attendanceDetail?.check_in_geolocation?.address && attendanceDetail.check_in_geolocation.address !== 'Unknown') && (
                      <div className="px-4 py-2 border-t border-gray-800">
                        <p className="text-gray-500 text-xs truncate">📍 {attendanceDetail.check_in_geolocation.address}</p>
                      </div>
                    )}
                  </div>

                  {/* Check Out */}
                  <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                      <span className="text-red-400 font-bold text-xs tracking-widest">CHECK OUT</span>
                      <span className="text-gray-300 font-mono text-sm">{attendanceDetail?.check_out_time || attendanceDetail?.attendance_details?.check_out_time || '—'}</span>
                    </div>
                    <div className="flex items-center justify-center bg-[#111] min-h-[200px] relative">
                      {(attendanceDetail?.check_out_photo_path || attendanceDetail?.check_out_photo || attendanceDetail?.attendance_details?.check_out_photo_path) ? (
                        <img
                          src={`${BASE_URL}/${attendanceDetail.check_out_photo_path || attendanceDetail.check_out_photo || attendanceDetail.attendance_details.check_out_photo_path}`}
                          alt="Check-out"
                          className="w-full object-cover max-h-[220px]"
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                      ) : null}
                      <div className={`flex-col items-center justify-center gap-2 text-center p-6 ${(attendanceDetail?.check_out_photo_path || attendanceDetail?.check_out_photo || attendanceDetail?.attendance_details?.check_out_photo_path) ? 'hidden' : 'flex'}`}>
                        <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center">
                          <Frown className="w-7 h-7 text-gray-500" />
                        </div>
                        <p className="text-gray-500 text-xs">No photo</p>
                      </div>
                    </div>
                    {(attendanceDetail?.check_out_geolocation?.address && attendanceDetail.check_out_geolocation.address !== 'Unknown') && (
                      <div className="px-4 py-2 border-t border-gray-800">
                        <p className="text-gray-500 text-xs truncate">📍 {attendanceDetail.check_out_geolocation.address}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Update Record (edit permission only) */}
                {hasEditPermission() && (() => {
                  const statusOptions = [
                    { value: 'P',  label: 'FULL DAY',  num: '1',   color: 'text-green-400 border-green-700' },
                    { value: 'HD', label: 'HALF DAY',  num: '0.5', color: 'text-yellow-400 border-yellow-700' },
                    { value: 'A',  label: 'ABSENT',    num: '0',   color: 'text-orange-400 border-orange-700' },
                    { value: 'AB', label: 'ABSCONDING',num: '-1',  color: 'text-red-400 border-red-700' },
                  ]
                  const activeOpt = statusOptions.find(o => o.value === selectedAttendance)
                  return (
                    <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-5 space-y-3">
                      <p className="text-gray-500 text-xs font-semibold tracking-widest">UPDATE RECORD</p>
                      <div className="relative" ref={statusDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                          className="w-full flex items-center justify-between px-4 py-3.5 bg-[#111] border border-gray-600 rounded-xl text-white font-semibold hover:border-gray-500 transition-all"
                        >
                          {activeOpt ? (
                            <span className="font-bold tracking-wide uppercase">{activeOpt.label}</span>
                          ) : (
                            <span className="text-gray-500 font-normal">Select Status</span>
                          )}
                          <svg className={`w-4 h-4 text-gray-400 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {statusDropdownOpen && (
                          <div className="absolute z-50 mt-1 w-full bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                            {statusOptions.map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => { setSelectedAttendance(opt.value); setStatusDropdownOpen(false) }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-800 font-bold tracking-wide text-sm ${selectedAttendance === opt.value ? 'bg-gray-800' : ''}`}
                              >
                                <span className={`text-xs border rounded px-1.5 py-0.5 ${opt.color}`}>{opt.num}</span>
                                <span className="text-white uppercase">{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleUpdate}
                        disabled={!selectedAttendance}
                        className="w-full py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold tracking-widest text-sm rounded-xl transition-colors uppercase"
                      >
                        UPDATE ATTENDANCE
                      </button>
                    </div>
                  )
                })()}

                {/* Comments */}
                <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-5 space-y-3">
                  <p className="text-gray-500 text-xs font-semibold tracking-widest">COMMENTS</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="flex-1 bg-[#111] border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gray-500"
                      onKeyPress={(e) => e.key === 'Enter' && handleSendComment()}
                    />
                    <button
                      onClick={handleSendComment}
                      disabled={loading || !newComment.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 text-sm font-semibold"
                    >
                      <Send className="w-3.5 h-3.5" /> Send
                    </button>
                  </div>
                  {comments.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {comments.map((c, i) => (
                        <div key={c._id || i} className="bg-[#111] border border-gray-800 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-indigo-400 text-xs font-semibold">{c.user_name || c.user || 'Unknown'}</span>
                            <span className="text-gray-600 text-xs">{c.created_at ? formatDateTime(c.created_at) : c.timestamp}</span>
                          </div>
                          <p className="text-gray-300 text-sm">{c.content || c.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {comments.length === 0 && !loading && (
                    <p className="text-gray-600 text-xs text-center py-2">No comments yet</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right: Activity History panel */}
          <div className="w-64 border-l border-gray-800 flex flex-col flex-shrink-0 bg-[#0a0a0a]">
            <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-800">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-gray-300 font-bold text-xs tracking-widest uppercase">Activity History</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((record, index) => (
                    <div key={record._id || index} className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-3">
                      <p className="text-gray-400 text-xs">{formatDateTime(record.changed_at)}</p>
                      <p className="text-white text-xs font-semibold mt-0.5">{record.action}</p>
                      {record.old_value !== undefined && (
                        <p className="text-gray-500 text-xs">{record.old_value} → {record.new_value}</p>
                      )}
                      {record.changed_by_name && (
                        <p className="text-indigo-400 text-xs mt-0.5">by {record.changed_by_name}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
                  <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center">
                    <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 text-xs font-semibold tracking-widest uppercase">No history for this date</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Reason Modal ── */}
      {showReasonModal && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowReasonModal(false); setUpdateReason('') } }}
        >
          <div className="bg-[#111] border border-amber-500/50 rounded-2xl max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-5 rounded-t-2xl">
              <h3 className="text-lg font-bold flex items-center gap-2"><Send className="w-4 h-4" /> Update Reason Required</h3>
              <p className="text-amber-100 text-xs mt-0.5">Please provide a reason for this attendance update</p>
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-amber-400 font-semibold text-sm">Reason <span className="text-red-400">*</span></label>
              <textarea
                value={updateReason}
                onChange={(e) => setUpdateReason(e.target.value)}
                placeholder="Enter reason for updating attendance..."
                rows={4}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none"
                autoFocus style={{ pointerEvents: 'auto' }}
              />
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex gap-2 text-xs text-gray-400">
                <span>ℹ️</span> This reason will be permanently recorded in the edit history.
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3 justify-end">
              <button onClick={() => { setShowReasonModal(false); setUpdateReason('') }} className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm font-semibold transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirmUpdate} disabled={!updateReason.trim()} className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors">
                <Send className="w-3.5 h-3.5" /> Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Returns numeric value for a day status cell
const getDayNumericValue = (status) => {
  switch (status) {
    case "P": return 1
    case "L": return 1     // Late counts as full present
    case "HD": return 0.5
    case "LV": return 0    // Leave counts as 0 in present score
    case "AB": return -1   // Absconding reduces score
    case "A": return -1    // Absent reduces score
    case "SP": return 1    // Sunday Paid — full day paid
    case "S0": return 0    // Sunday Zero — not paid, not penalized
    case "H": return null  // Holiday – excluded from present calc
    case "W": return null  // Weekend – excluded
    default: return null   // Not marked – excluded
  }
}

const calculateMonthlyStats = (record, selectedYear, selectedMonth, daysInMonth, holidays) => {
  let presentScore = 0
  let lvDaysTaken = 0  // Leave days taken (LV status) — counted for reference only
  let absconding = 0
  let holidaysCount = 0

  for (let day = 1; day <= daysInMonth; day++) {
    const status = record[`day${day}`]
    const val = getDayNumericValue(status)
    if (status === 'H') {
      holidaysCount++
    } else if (status === 'LV') {
      lvDaysTaken++
    } else if (status === 'AB') {
      presentScore -= 1
      absconding++
    } else if (val !== null) {
      presentScore += val
    }
  }

  // EL → actual remaining balance from Leave Management (earned over time, shows 0 if none allocated)
  // PL → fixed monthly allotment from attendance settings (same credit every month regardless of accumulated balance)
  // Grace → monthly limit from attendance settings
  const elDays = record.earnedLeavesRemaining ?? 0            // EL: actual balance (from Leave Management)
  const plDays = parseFloat(record.plMonthly ?? 1.0)          // PL: per-month allotment (from attendance settings)
  const graceMonthly = record.graceMonthlyLimit ?? 3          // Grace limit per month (from attendance settings)
  const graceRemainingMonthly = Math.min(record.graceRemaining ?? graceMonthly, graceMonthly)

  // Final attendance = Present + PL (monthly) + EL (remaining), only if Present > 0
  const finalScore = presentScore > 0 ? (presentScore + plDays + elDays) : 0

  const workingDays = daysInMonth - holidaysCount
  const attendancePercentage = workingDays > 0 ? ((Math.max(0, presentScore) / workingDays) * 100).toFixed(1) : "0"

  return {
    presentScore,
    plDays,          // PL remaining (actual, from Leave Management)
    elDays,          // EL remaining (actual, from Leave Management)
    graceRemaining: graceRemainingMonthly, // Monthly grace remaining
    graceTotal: graceMonthly, // Monthly grace total (from settings)
    finalScore,
    absconding,
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
  const [attendanceSettings, setAttendanceSettings] = useState({
    enable_sunday_sandwich_rule: true,
    enable_adjacent_absconding_rule: true,
    minimum_working_days_for_sunday: 5,
    auto_grace_monthly_limit: 3,
    default_earned_leave_monthly: 1.5,
    default_paid_leave_monthly: 1.0,
  })
  const [salaryModalOpen, setSalaryModalOpen] = useState(false)
  const [selectedSalaryData, setSelectedSalaryData] = useState(null)
  const [monthlyLeaves, setMonthlyLeaves] = useState([])
  const [leavesMap, setLeavesMap] = useState(new Map())
  const [editHistoryModalOpen, setEditHistoryModalOpen] = useState(false)
  const [selectedEmployeeHistory, setSelectedEmployeeHistory] = useState(null)
  const [editHistoryData, setEditHistoryData] = useState([])
  const [editCounts, setEditCounts] = useState({}) // { [empId]: count } — increments on each edit

  // Apply attendance rules to formatted records
  const applyAttendanceRules = (records, settings, year, month) => {
    if (!settings) return records
    const MIN_DAYS_FOR_SUNDAY = 4 // Minimum present days (including holidays) for Sunday to be paid
    return records.map(record => {
      const updated = { ...record }
      const daysInM = new Date(year, month, 0).getDate()

      // ── SUNDAY RULES ──
      // Sunday is paid (+1, SP) only if employee has minimum 4 days present in Mon-Sat.
      // P, L, HD, H all count towards the 4-day minimum (including holidays).
      // Exceptions:
      //   1. Saturday AB → Sunday = AB (-1, red)
      //   2. Monday AB  → BOTH Saturday AND Sunday = S0 (0, white/black)

      for (let d = 1; d <= daysInM; d++) {
        const dateObj = new Date(year, month - 1, d)
        if (dateObj.getDay() !== 0) continue // Only process Sundays

        const satDay = d - 1  // Saturday before this Sunday
        const monDay = d + 1  // Monday after this Sunday

        const satStatus = satDay >= 1 ? updated[`day${satDay}`] : null
        const monStatus = monDay <= daysInM ? updated[`day${monDay}`] : null

        // Count present days Mon-Sat (P, L, HD count as attendance; H counts too)
        let presentDays = 0
        let hasAnyData = false
        for (let w = Math.max(1, d - 6); w <= Math.min(daysInM, d - 1); w++) {
          const wDow = new Date(year, month - 1, w).getDay()
          if (wDow === 0) continue // skip any Sunday
          const s = updated[`day${w}`]
          if (s === 'P' || s === 'L' || s === 'HD' || s === 'AB' || s === 'LV') hasAnyData = true
          // P, L = full day; HD = half day (still counts as 1 day present); H = holiday (counts)
          if (s === 'P' || s === 'L' || s === 'HD' || s === 'H') presentDays++
        }
        // Also check Monday after Sunday for hasAnyData (to detect future absconding)
        if (monDay <= daysInM) {
          const ms = updated[`day${monDay}`]
          if (ms === 'P' || ms === 'L' || ms === 'HD' || ms === 'AB' || ms === 'LV') hasAnyData = true
        }
        if (!hasAnyData) continue // No data yet — keep as W (weekend dash)

        // Priority 1: Saturday AB → Sunday = AB (-1)
        if (satStatus === 'AB') {
          updated[`day${d}`] = 'AB'
        }
        // Priority 2: Monday AB → Saturday = S0 (0) AND Sunday = S0 (0)
        else if (monStatus === 'AB') {
          updated[`day${d}`] = 'S0'
          if (satDay >= 1 && satStatus !== 'AB') {
            updated[`day${satDay}`] = 'S0'
          }
        }
        // Default: Sunday paid only if minimum 4 present days (including holidays) in Mon-Sat
        else if (presentDays >= MIN_DAYS_FOR_SUNDAY) {
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
    // Get user permissions from localStorage
    const userPermissions = getUserPermissions();
    
    // Superadmin with wildcard (*) can always edit attendance
    if (isSuperAdmin(userPermissions)) {
      return true;
    }
    
    // STRICT CHECK: User must have explicit 'update' action in attendance permissions
    // 'all' permission does NOT grant update access
    if (Array.isArray(userPermissions)) {
      const attendancePerm = userPermissions.find(p => p.page === 'attendance');
      if (attendancePerm && Array.isArray(attendancePerm.actions)) {
        // Only return true if 'update' is explicitly in the actions array
        return attendancePerm.actions.includes('update');
      }
    }
    
    return false; // No update permission found
  };
  const canUserDelete = (recordOwnerId) => canDelete('attendance', recordOwnerId);

  // Legacy compatibility functions
  const isAdmin = () => canUserViewAll();
  const hasAdminPermissions = () => canUserViewAll();
  
  // Legacy compatibility for the old canViewAll function
  const canViewAllRecords = () => canUserViewAll();

  // Convert API response to calendar format and filter by active employees
  const convertToCalendarFormat = (apiData, activeEmployeeIds = null, salaryMap = {}) => {
    if (!apiData?.employees?.length) {
      return [];
    }

    console.log('🔍 Total employees from API:', apiData.employees.length);
    console.log('🔍 Active employee IDs set:', activeEmployeeIds);

    const filtered = apiData.employees
      .filter(employee => {
        // Check if employee has any actual attendance records for this month
        const hasAttendance = employee.days && employee.days.some(day => {
          const status = parseFloat(day.status);
          // Check for any actual attendance status (P, HD, LV, AB, L)
          return status === 1.0 || status === 1 || // Present
                 status === 0.5 || // Half Day
                 status === 0 || status === 0.0 || // Leave
                 status === -2 || status === -2.0 || // Absconding
                 day.status === "L"; // Late
        });

        // STRICT FILTERING: Only if we have active employee list
        if (activeEmployeeIds && activeEmployeeIds.size > 0) {
          // Try multiple ID formats for matching
          const empId = employee.employee_id;
          const empIdStr = String(empId);
          const empIdNum = Number(empId);
          
          const isActiveEmployee = activeEmployeeIds.has(empId) || 
                                   activeEmployeeIds.has(empIdStr) || 
                                   activeEmployeeIds.has(empIdNum);
          
          // Debug log for each employee
          console.log(`👤 ${employee.employee_name} (ID: ${empId}, type: ${typeof empId}):`, {
            isActive: isActiveEmployee,
            hasAttendance: hasAttendance,
            willShow: isActiveEmployee || hasAttendance,
            checkedIDs: [empId, empIdStr, empIdNum]
          });
          
          // Show employee ONLY if:
          // 1. They are in the active employees list, OR
          // 2. They have attendance for this month (inactive with historical data)
          return isActiveEmployee || hasAttendance;
        }

        // STRICT: If no active employee list, show ONLY those with attendance
        console.log(`⚠️ No active employee list, filtering by attendance only. ${employee.employee_name} - hasAttendance:`, hasAttendance);
        return hasAttendance;
        return hasAttendance;
      })
      .map(employee => {
      // Create a record for each employee with day status mapping
      // Look up salary from salary map using multiple ID formats
      const empId = employee.employee_id;
      const empSalary = salaryMap[empId] || salaryMap[String(empId)] || 0;
      
      const employeeRecord = {
        id: employee.employee_id,
        mongoId: employee.user_mongo_id || employee.employee_id, // MongoDB _id for history API calls
        name: employee.employee_name,
        employeeId: employee.employee_code || employee.employee_number || employee.empId || `EMP-${employee.employee_id?.slice(-6) || 'UNKNOWN'}`,
        department: employee.department_name || "Unknown Department",
        role: employee.role_name || "",
        photo: employee.employee_photo,
        salary: empSalary
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
              // Sunday Present → blue (SP), regular present → green (P)
              employeeRecord[dayKey] = day.is_weekend ? 'SP' : 'P';
            } else if (status === 0.5) {
              employeeRecord[dayKey] = 'HD'; // Half Day (different from holiday)
            } else if (status === 0 || status === 0.0) {
              // Sunday Absent → S0, leave → LV
              employeeRecord[dayKey] = day.is_weekend ? 'S0' : 'LV';
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
    
    console.log('✅ Filtered to', filtered.length, 'employees');
    return filtered;
  };

  // Fetch attendance data when component mounts or month changes
  useEffect(() => {
    const fetchAttendanceData = async () => {
      if (!user?.user_id) return
      
      setLoading(true)
      setError(null)
      setEditCounts({}) // Reset edit counts when month/year changes
      
      try {
        // Fetch active employees list first
        let activeEmployeeIds = null;
        const salaryMap = {};
        try {
          const employeesResponse = await hrmsService.getAllEmployees();
          if (employeesResponse?.data) {
            console.log('📊 All employees from HRMS:', employeesResponse.data.length);
            
            const activeEmployees = employeesResponse.data.filter(emp => {
              const isActive = emp.employee_status === 'active' || emp.is_active === true;
              if (!isActive) {
                console.log('❌ Inactive employee:', emp.first_name, emp.last_name, '- employee_id:', emp.employee_id, '- status:', emp.employee_status);
              }
              return isActive;
            });
            
            console.log('✅ Active employees count:', activeEmployees.length);
            
            // Create a Set of active employee IDs for fast lookup
            // Store in multiple formats to handle type mismatches
            activeEmployeeIds = new Set();
            activeEmployees.forEach(emp => {
              const empId = emp.employee_id || emp._id;
              if (empId) {
                activeEmployeeIds.add(empId);
                activeEmployeeIds.add(String(empId));
                activeEmployeeIds.add(Number(empId));
              }
            });
            
            // Build salary map from same employee data (no extra API call)
            employeesResponse.data.forEach(emp => {
              const eid = emp.employee_id || emp._id;
              const sal = parseFloat(emp.salary) || 0;
              if (eid && sal > 0) {
                salaryMap[eid] = sal;
                salaryMap[String(eid)] = sal;
              }
            });
            
            console.log('✅ Active employee IDs (with all formats):', Array.from(activeEmployeeIds).slice(0, 50));
            console.log('💰 Salary map built for', Object.keys(salaryMap).length / 2, 'employees');
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
          const formattedData = convertToCalendarFormat(response, activeEmployeeIds, salaryMap)

          // Fetch leave balances for all employees in parallel
          const leaveBalanceResults = await Promise.allSettled(
            formattedData.map(record =>
              axios.get(`${BASE_URL}/settings/leave-balance/${record.id}`, {
                params: { user_id: user.user_id },
                headers: getAuthHeaders()
              }).then(res => ({ id: record.id, data: res.data?.data || {} }))
            )
          )

          // Merge leave balance data into each record
          const balanceMap = {}
          leaveBalanceResults.forEach(result => {
            if (result.status === 'fulfilled' && result.value?.id) {
              balanceMap[result.value.id] = result.value.data
            }
          })

          const enrichedData = formattedData.map(record => {
            const bal = balanceMap[record.id] || {}
            return {
              ...record,
              earnedLeavesTotal: bal.earned_leaves_total ?? 0,
              earnedLeavesUsed: bal.earned_leaves_used ?? 0,
              earnedLeavesRemaining: bal.earned_leaves_remaining ?? 0,
              paidLeavesTotal: bal.paid_leaves_total ?? 0,
              paidLeavesUsed: bal.paid_leaves_used ?? 0,
              paidLeavesRemaining: bal.paid_leaves_remaining ?? 0,
              graceTotal: bal.grace_leaves_total ?? settingsData.auto_grace_monthly_limit ?? 3,
              graceUsed: bal.grace_leaves_used ?? 0,
              graceRemaining: bal.grace_leaves_remaining ?? settingsData.auto_grace_monthly_limit ?? 3,
              // Settings-based monthly allotments kept for reference (used by auto-credit logic)
              elMonthly: settingsData.default_earned_leave_monthly ?? 1.5,
              plMonthly: settingsData.default_paid_leave_monthly ?? 1.0,
              graceMonthlyLimit: settingsData.auto_grace_monthly_limit ?? 3,
            }
          })

          const ruledData = applyAttendanceRules(enrichedData, settingsData, selectedYear, selectedMonth)
          console.log('Formatted data:', ruledData)
          setAttendanceData(ruledData)

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
    }

    fetchAttendanceData()
  }, [selectedYear, selectedMonth, user])

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
  
  // Calculate visible days (hide future dates in current month)
  const getVisibleDays = () => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1
    const currentDay = today.getDate()
    
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
    setSelectedEmployee(employee)
    setSelectedDate(1) // Default to first day
    setModalOpen(true)
  }

  const handleDayClick = async (employee, day) => {
    if (!user?.user_id) return
    
    // Block editing for future dates
    const clickedDate = new Date(selectedYear, selectedMonth - 1, day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (clickedDate > today) {
      alert('Cannot edit attendance for future dates!')
      return
    }
    
    setSelectedEmployee(employee)
    setSelectedDate(day)
    setModalOpen(true)
    setLoading(true)
    
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
        attendanceDetail: detailData
      })
    } catch (error) {
      console.error('Error fetching attendance detail:', error)
    }
    
    setLoading(false)
    setSelectedDate(day)
    setModalOpen(true)
  }

  const handleSalaryClick = async (employee, stats, calculatedSalary) => {
    // Set modal data immediately (open it fast), then enrich with penalties
    setSelectedSalaryData({
      employee,
      stats,
      calculatedSalary,
      monthlySalary: employee.salary || 0,
      perDaySalary: (employee.salary || 0) / daysInMonth,
      selectedYear,
      selectedMonth,
      daysInMonth,
      warningPenalties: []
    })
    setSalaryModalOpen(true)

    // Fetch warning penalties in background
    try {
      const empId = employee.mongoId || employee.id
      const userData = getUserData()
      if (empId && userData?.user_id) {
        const resp = await axios.get(
          `${BASE_URL}/warnings/penalties/employee/${empId}?month=${selectedMonth}&year=${selectedYear}&user_id=${userData.user_id}`,
          { headers: getAuthHeaders() }
        )
        if (resp.data?.success) {
          setSelectedSalaryData(prev => prev ? {
            ...prev,
            warningPenalties: resp.data.penalties || []
          } : prev)
        }
      }
    } catch (err) {
      console.warn('Could not load warning penalties for salary:', err)
    }
  }

  const handleEditHistoryClick = async (employee) => {
    if (!user?.user_id) return
    
    console.log('📋 [EDIT HISTORY] Opening history for employee:', employee.id, employee.name)
    
    setSelectedEmployeeHistory(employee)
    setLoading(true)
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
        // Sort by timestamp descending (most recent first)
        const sortedHistory = historyResponse.history.sort((a, b) => 
          new Date(b.changed_at || b.timestamp || b.created_at) - new Date(a.changed_at || a.timestamp || a.created_at)
        )
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
      setLoading(false)
    }
  }

  const handleUpdateAttendance = (employeeId, day, newStatus) => {
    setAttendanceData((prevData) => {
      // Update the specific day
      const updated = prevData.map((employee) =>
        employee.id === employeeId ? { ...employee, [`day${day}`]: newStatus } : employee
      )
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
        // Fetch active employees list first
        let activeEmployeeIds = null;
        const salaryMap2 = {};
        try {
          const employeesResponse = await hrmsService.getAllEmployees();
          if (employeesResponse?.data) {
            activeEmployeeIds = new Set(
              employeesResponse.data
                .filter(emp => emp.employee_status === 'active' || emp.is_active === true)
                .map(emp => emp.employee_id || emp._id)
            );
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
          let formattedData = convertToCalendarFormat(response, activeEmployeeIds, salaryMap2)
          
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
    <div className="w-full bg-black leading-none" style={{lineHeight: '0'}}>
      {/* Header */}
      <div className="bg-black mb-0" style={{marginBottom: '0', paddingBottom: '0'}}>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center" style={{margin: '0', padding: '0'}}>
          <div></div>

          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateMonth("prev")}
                className="border border-gray-600 bg-black text-white hover:bg-gray-800 px-2 py-0.5 rounded-md transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
                <div className="flex items-center gap-1 min-w-[200px] justify-center">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="font-semibold text-xs text-white">
                    {months[selectedMonth - 1]} {selectedYear}
                  </span>
              </div>
              <button
                onClick={() => navigateMonth("next")}
                className="border border-gray-600 bg-black text-white hover:bg-gray-800 px-2 py-0.5 rounded-md transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {canViewAllRecords() && (
              <button
                onClick={() => setHolidayModalOpen(true)}
                className="border border-gray-600 bg-black text-white hover:bg-gray-800 px-2 py-0.5 rounded-md transition-colors flex items-center gap-1 text-xs"
              >
                <Calendar className="h-3 w-3 mr-1" />
                Holidays
              </button>
            )}

            <button
              onClick={() => exportToPDF(attendanceData, selectedYear, selectedMonth, holidays)}
              className="border border-gray-600 bg-black text-white hover:bg-gray-800 px-2 py-0.5 rounded-md transition-colors flex items-center gap-1 text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-black mb-2 mt-2 py-3">
        <div className="flex flex-wrap gap-4 items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-7 bg-emerald-500 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md">1</div>
            <span className="text-sm font-semibold text-white">FULL DAY</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-7 bg-amber-400 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md">0.5</div>
            <span className="text-sm font-semibold text-white">HALF DAY</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-7 bg-orange-500 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md">0</div>
            <span className="text-sm font-semibold text-white">ABSENT</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-7 bg-rose-500 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md">-1</div>
            <span className="text-sm font-semibold text-white">ABSCONDING</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-7 bg-cyan-500 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md">1</div>
            <span className="text-sm font-semibold text-white">HOLIDAY</span>
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 mb-3 mt-2">
        <div className="bg-black rounded p-3 border border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {attendanceData.reduce(
                (acc, record) =>
                  acc + calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays).presentScore,
                0,
              ).toFixed(1)}
            </div>
            <div className="text-sm text-gray-300 mt-1">Total Present Score</div>
          </div>
        </div>
        <div className="bg-black rounded p-3 border border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">
              {attendanceData.reduce(
                (acc, record) =>
                  acc + calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays).absconding,
                0,
              )}
            </div>
            <div className="text-sm text-gray-300 mt-1">Total Absconding Days</div>
          </div>
        </div>
        <div className="bg-black rounded p-3 border border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-400">
              {attendanceData.reduce(
                (acc, record) => {
                  const stats = calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays)
                  return acc + stats.graceRemaining
                },
                0,
              )}
            </div>
            <div className="text-sm text-gray-300 mt-1">Total Grace Remaining</div>
          </div>
        </div>
        <div className="bg-black rounded p-3 border border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              {attendanceData.reduce(
                (acc, record) =>
                  acc + calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays).plDays,
                0,
              )}
            </div>
            <div className="text-sm text-gray-300 mt-1">Total PL (Paid Leave)</div>
          </div>
        </div>
        <div className="bg-black rounded p-3 border border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">
              {attendanceData.length > 0 ? (
                attendanceData.reduce((acc, record) => {
                  const stats = calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays)
                  return acc + stats.finalScore
                }, 0).toFixed(1)
              ) : '0'}
            </div>
            <div className="text-sm text-gray-300 mt-1">Total FINAL Score</div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-black overflow-hidden mt-0" style={{marginTop: '0'}}>
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
              {/* Row 1: main headers */}
              <tr>
                <th colSpan={3} className="sticky left-0 px-2 py-1 text-center font-bold text-white border border-gray-300" style={{backgroundColor: '#03b0f5'}}>
                  Employee Details
                </th>
                {Array.from({ length: visibleDays }, (_, i) => i + 1).map((day) => {
                  const dayName = getDayName(selectedYear, selectedMonth, day)
                  const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const isHoliday = holidays.some(h => h.date === dateStr)
                  const isSunday = dayName === 'Sun'
                  
                  return (
                    <th 
                      key={day} 
                      rowSpan={2} 
                      className="px-3 py-1 text-center font-bold text-white min-w-[50px] border border-gray-300" 
                      style={{
                        backgroundColor: (isSunday || isHoliday) ? '#6366f1' : '#03b0f5'
                      }}
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-bold">{day}</span>
                        <span className="text-xs text-blue-100 opacity-80">{dayName}</span>
                        {isHoliday && <span className="text-xs text-yellow-300">🎉</span>}
                      </div>
                    </th>
                  )
                })}
                <th colSpan={7} className="px-2 py-1 text-center font-bold text-white border border-gray-300" style={{backgroundColor: '#03b0f5'}}>
                  Summary
                </th>
              </tr>
              {/* Row 2: sub-columns for Employee Details + Summary */}
              <tr>
                <th className="sticky left-0 px-2 py-1 text-left font-bold text-white min-w-[100px] border border-gray-300 z-[3]" style={{backgroundColor: '#03b0f5'}}>
                  Emp ID
                </th>
                <th className="sticky left-[100px] px-2 py-1 text-left font-bold text-white min-w-[150px] border border-gray-300 z-[3]" style={{backgroundColor: '#03b0f5'}}>
                  Name
                </th>
                <th className="sticky left-[250px] px-2 py-1 text-left font-bold text-white min-w-[130px] border border-gray-300 z-[3]" style={{backgroundColor: '#03b0f5'}}>
                  Team
                </th>
                <th className="px-3 py-1 text-center font-bold text-white min-w-[55px] border border-gray-300" style={{backgroundColor: '#f59e0b'}}>EDIT</th>
                <th className="px-3 py-1 text-center font-bold text-white min-w-[65px] border border-gray-300" style={{backgroundColor: '#03b0f5'}}>present</th>
                <th className="px-3 py-1 text-center font-bold text-white min-w-[65px] border border-gray-300" style={{backgroundColor: '#17a2b8'}}>Grace</th>
                <th className="px-3 py-1 text-center font-bold text-white min-w-[55px] border border-gray-300" style={{backgroundColor: '#6f42c1'}}>PL</th>
                <th className="px-3 py-1 text-center font-bold text-white min-w-[55px] border border-gray-300" style={{backgroundColor: '#1e7e34'}}>EL</th>
                <th className="px-3 py-1 text-center font-bold text-white min-w-[65px] border border-gray-300" style={{backgroundColor: '#e67e22'}}>FINAL</th>
                <th className="px-3 py-1 text-center font-bold text-white min-w-[75px] border border-gray-300" style={{backgroundColor: '#10b981'}}>SALARY</th>
              </tr>
            </thead>
            <tbody className="bg-black">
              {attendanceData.map((record, index) => {
                const stats = calculateMonthlyStats(record, selectedYear, selectedMonth, daysInMonth, holidays)
                const isEvenRow = index % 2 === 0
                
                // Calculate salary
                const monthlySalary = record.salary || 0
                const perDaySalary = monthlySalary / daysInMonth
                const calculatedSalary = Math.round(perDaySalary * stats.finalScore)
                
                return (
                  <tr
                    key={record.id}
                    className="bg-black hover:bg-gray-800 transition-colors border-b border-gray-700"
                  >
                    <td className="sticky left-0 bg-black px-2 py-1 border border-gray-600 text-sm text-blue-300 font-medium cursor-pointer hover:bg-gray-700 transition-colors z-[2]" onClick={() => handleEmployeeClick(record)}>
                      {record.employeeId}
                    </td>
                    <td className="sticky left-[100px] bg-black px-2 py-1 border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors z-[2]" onClick={() => handleEmployeeClick(record)}>
                      <div className="font-semibold text-white text-base">{record.name}</div>
                    </td>
                    <td className="sticky left-[250px] bg-black px-2 py-1 border border-gray-600 z-[2]">
                      <div className="text-sm text-gray-400">{record.department}</div>
                    </td>
                    {Array.from({ length: visibleDays }, (_, i) => i + 1).map((day) => {
                      const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const mapKey = `${record.mongoId || record.id}_${dateKey}`
                      const leaveStatus = leavesMap.get(mapKey) || null
                      
                      return (
                        <td
                          key={day}
                          className="px-2 py-1 text-center cursor-pointer hover:bg-gray-700 border border-gray-600 transition-colors"
                          onClick={() => handleDayClick(record, day)}
                        >
                          {getStatusBadge(record[`day${day}`], leaveStatus)}
                        </td>
                      )
                    })}
                    <td 
                      className="px-2 py-1 text-center border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors"
                      onClick={() => handleEditHistoryClick(record)}
                    >
                      <span style={{background:'#f59e0b',color:'#000',borderRadius:'999px',fontSize:'11px',fontWeight:800,padding:'1px 8px',lineHeight:'18px',minWidth:'20px',display:'inline-block',textAlign:'center'}}>
                        {editCounts[record.id] || 0}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-center border border-gray-600 font-bold text-sm">
                      <span className={stats.presentScore >= 0 ? 'text-green-400' : 'text-red-400'}>{stats.presentScore}</span>
                    </td>
                    <td className="px-2 py-1 text-center border border-gray-600 font-bold text-cyan-300 text-sm">{stats.graceRemaining}/{stats.graceTotal}</td>
                    <td className="px-2 py-1 text-center border border-gray-600 font-bold text-purple-300 text-sm">{stats.plDays}</td>
                    <td className="px-2 py-1 text-center border border-gray-600 font-bold text-green-300 text-sm">{stats.elDays}</td>
                    <td className="px-2 py-1 text-center border border-gray-600 font-bold text-orange-300 text-sm">{stats.finalScore}</td>
                    <td 
                      className="px-2 py-1 text-center border border-gray-600 font-bold text-green-400 text-sm cursor-pointer hover:bg-gray-700 transition-colors"
                      onClick={() => handleSalaryClick(record, stats, calculatedSalary)}
                    >
                      ₹{calculatedSalary.toLocaleString('en-IN')}
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

      {/* Salary Detail Modal */}
      <SalaryDetailModal
        isOpen={salaryModalOpen}
        onClose={() => setSalaryModalOpen(false)}
        salaryData={selectedSalaryData}
      />

      {/* Edit History Modal */}
      <EditHistoryModal
        isOpen={editHistoryModalOpen}
        onClose={() => setEditHistoryModalOpen(false)}
        employee={selectedEmployeeHistory}
        historyData={editHistoryData}
        loading={loading}
      />
    </div>
  )
}
