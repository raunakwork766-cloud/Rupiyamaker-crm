"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronLeft, ChevronRight, Download, Calendar, X, Frown, User, Send, Plus, Trash2 } from "lucide-react"
import axios from "axios"
import { formatDateTime } from '../utils/dateUtils';
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
        <div className="w-8 h-8 bg-green-500 text-white rounded flex items-center justify-center text-xs font-bold">
          P
        </div>
      )
    case "L":
      return (
        <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 text-white rounded flex items-center justify-center text-xs font-bold">
          L
        </div>
      )
    case "LV":
      return (
        <div className="w-8 h-8 bg-orange-500 text-white rounded flex items-center justify-center text-xs font-bold">
          LV
        </div>
      )
    case "H":
      return (
        <div className="w-8 h-8 bg-blue-500 text-white rounded flex items-center justify-center text-xs font-bold">
          H
        </div>
      )
    case "HD":
      return (
        <div className="w-8 h-8 bg-yellow-500 text-white rounded flex items-center justify-center text-xs font-bold">
          HD
        </div>
      )
    case "AB":
      return (
        <div className="w-8 h-8 bg-red-500 text-white rounded flex items-center justify-center text-xs font-bold">
          AB
        </div>
      )
    default:
      return <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center text-xs text-gray-400">-</div>
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
    case "HD":
      return "HALF DAY"
    case "AB":
      return "ABSCONDING"
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
    if (!selectedAttendance || !user?.user_id) return
    
    setLoading(true)
    try {
      // Convert status to backend format
      let statusValue
      switch (selectedAttendance) {
        case "P": statusValue = 1; break
        case "L": statusValue = 0.5; break
        case "H": statusValue = 0; break
        case "AB": statusValue = -1; break
        default: statusValue = -1
      }

      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`
      
      // If we have an attendance record, edit it
      if (attendanceDetail?.id) {
        const editData = {
          status: statusValue,
          comments: newComment || ''
        }
        await attendanceAPI.editAttendance(attendanceDetail.id, editData, user.user_id)
      } else {
        // Create new attendance record
        const attendanceData = {
          employee_id: employee.id,
          date: dateStr,
          status: statusValue,
          comments: newComment || '',
          check_in_time: null,
          check_out_time: null,
          is_holiday: false
        }
        await attendanceAPI.markAttendance(attendanceData, user.user_id)
      }
      
      // Update parent component
      if (onUpdate) {
        onUpdate(employee.id, selectedDate, selectedAttendance)
      }
      
      // Reload detail to get updated data
      await loadAttendanceDetail()
      
      alert('Attendance updated successfully!')
    } catch (error) {
      console.error('Error updating attendance:', error)
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
          ) : attendanceDetail?.type === 'leave' ? (
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

          {/* Change Attendance - Only show for attendance records, not leave, and only if user has edit permission */}
          {attendanceDetail?.type !== 'leave' && hasEditPermission() && (
            <div className="mt-6">
              <label className="block text-gray-200 font-semibold mb-2">CHANGE ATTENDANCE:</label>
              <select
                value={selectedAttendance}
                onChange={(e) => setSelectedAttendance(e.target.value)}
                className="w-full p-3 border border-gray-600 rounded-lg bg-gray-800 text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              >
                <option value="">Select Attendance Status</option>
                <option value="P">Present</option>
                <option value="L">Late</option>
                <option value="H">Holiday</option>
                <option value="AB">Absconding</option>
              </select>
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
              {/* Row 1: main headers */}
              <tr>
                <th colSpan={3} className="sticky left-0 px-4 py-1 text-center font-bold text-white border border-gray-300" style={{backgroundColor: '#03b0f5'}}>
                  Employee Details
                </th>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                  <th key={day} rowSpan={2} className="px-3 py-1 text-center font-bold text-white min-w-[50px] border border-gray-300" style={{backgroundColor: '#03b0f5'}}>
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-bold">{day}</span>
                      <span className="text-xs text-blue-100 opacity-80">{getDayName(selectedYear, selectedMonth, day)}</span>
                    </div>
                  </th>
                ))}
                <th colSpan={7} className="px-4 py-1 text-center font-bold text-white border border-gray-300" style={{backgroundColor: '#03b0f5'}}>
                  Summary
                </th>
              </tr>
              {/* Row 2: sub-columns for Employee Details + Summary */}
              <tr>
                <th className="sticky left-0 px-4 py-1 text-left font-bold text-white min-w-[100px] border border-gray-300" style={{backgroundColor: '#03b0f5'}}>
                  Emp ID
                </th>
                <th className="px-4 py-1 text-left font-bold text-white min-w-[150px] border border-gray-300" style={{backgroundColor: '#03b0f5'}}>
                  Name
                </th>
                <th className="px-4 py-1 text-left font-bold text-white min-w-[130px] border border-gray-300" style={{backgroundColor: '#03b0f5'}}>
                  Team
                </th>
                <th className="px-3 py-1 text-center font-bold text-white min-w-[60px] border border-gray-300" style={{backgroundColor: '#03b0f5'}}>Present</th>
                <th className="px-3 py-1 text-center font-bold text-white min-w-[60px] border border-gray-300" style={{backgroundColor: '#03b0f5'}}>Leave</th>
                <th className="px-3 py-1 text-center font-bold text-white min-w-[55px] border border-gray-300" style={{backgroundColor: '#03b0f5'}}>Late</th>
                <th className="px-3 py-1 text-center font-bold text-white min-w-[65px] border border-gray-300" style={{backgroundColor: '#03b0f5'}}>Half Day</th>
                <th className="px-3 py-1 text-center font-bold text-white min-w-[65px] border border-gray-300" style={{backgroundColor: '#03b0f5'}}>Holiday</th>
                <th className="px-3 py-1 text-center font-bold text-white min-w-[75px] border border-gray-300" style={{backgroundColor: '#03b0f5'}}>Abscond</th>
                <th className="px-3 py-1 text-center font-bold text-white min-w-[70px] border border-gray-300" style={{backgroundColor: '#03b0f5'}}>Attend %</th>
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
                    <td className="sticky left-0 bg-black px-4 py-5 border border-gray-600 text-sm text-blue-300 font-medium cursor-pointer hover:bg-gray-700 transition-colors" onClick={() => handleEmployeeClick(record)}>
                      {record.employeeId}
                    </td>
                    <td className="px-4 py-5 border border-gray-600 cursor-pointer hover:bg-gray-700 transition-colors" onClick={() => handleEmployeeClick(record)}>
                      <div className="font-semibold text-white text-base">{record.name}</div>
                    </td>
                    <td className="px-4 py-5 border border-gray-600">
                      <div className="text-sm text-gray-400">{record.department}</div>
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
                    <td className="px-2 py-3 text-center border border-gray-600 font-bold text-green-400 text-sm">{stats.present}</td>
                    <td className="px-2 py-3 text-center border border-gray-600 font-bold text-orange-400 text-sm">{stats.leave}</td>
                    <td className="px-2 py-3 text-center border border-gray-600 font-bold text-yellow-400 text-sm">{stats.late}</td>
                    <td className="px-2 py-3 text-center border border-gray-600 font-bold text-cyan-400 text-sm">{stats.halfDay}</td>
                    <td className="px-2 py-3 text-center border border-gray-600 font-bold text-blue-400 text-sm">{stats.holidays}</td>
                    <td className="px-2 py-3 text-center border border-gray-600 font-bold text-red-400 text-sm">{stats.absconding}</td>
                    <td className="px-2 py-3 text-center border border-gray-600 font-bold text-sm">
                      <span className={Number.parseFloat(stats.attendancePercentage) >= 90 ? 'text-green-400' : Number.parseFloat(stats.attendancePercentage) >= 75 ? 'text-yellow-400' : 'text-red-400'}>
                        {stats.attendancePercentage}%
                      </span>
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
    </div>
  )
}
