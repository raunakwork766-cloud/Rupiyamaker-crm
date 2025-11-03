import React, { useState, useEffect } from 'react';
import {
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
  CameraOutlined,
  FilterOutlined,
  ReloadOutlined,
  PlusOutlined,
  EyeOutlined
} from '@ant-design/icons';

const MonthlyCalendarTable = () => {
  // Current date state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  
  // Calendar data
  const [attendanceData, setAttendanceData] = useState([]);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);

  // Calendar grid data
  const [calendarGrid, setCalendarGrid] = useState([]);
  const [selectedDateDetails, setSelectedDateDetails] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Generate calendar grid for the month
  useEffect(() => {
    const generateCalendarGrid = () => {
      setIsLoading(true);
      setTimeout(() => {
        const firstDay = new Date(selectedYear, selectedMonth, 1);
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const startDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        // Create calendar grid (weeks x 7 days)
        const weeks = [];
        let currentWeek = [];
        
        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startDayOfWeek; i++) {
          currentWeek.push(null);
        }
        
        // Add all days of the month
        for (let day = 1; day <= lastDay; day++) {
          const date = new Date(selectedYear, selectedMonth, day);
          const dayOfWeek = date.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          
          const rand = Math.random();
          let status, statusText, checkIn, checkOut, hours, checkInPhoto, checkOutPhoto;

          if (isWeekend) {
            status = 'weekend';
            statusText = 'Weekend';
            checkIn = '-';
            checkOut = '-';
            hours = '-';
            checkInPhoto = null;
            checkOutPhoto = null;
          } else if (rand < 0.7) {
            status = 'present';
            statusText = 'Present';
            checkIn = '09:00 AM';
            checkOut = '06:00 PM';
            hours = '9.0h';
            checkInPhoto = rand < 0.8 ? 'https://via.placeholder.com/150x200' : null;
            checkOutPhoto = rand < 0.8 ? 'https://via.placeholder.com/150x200' : null;
          } else if (rand < 0.85) {
            status = 'halfday';
            statusText = 'Half Day';
            checkIn = '09:00 AM';
            checkOut = '01:00 PM';
            hours = '4.0h';
            checkInPhoto = rand < 0.8 ? 'https://via.placeholder.com/150x200' : null;
            checkOutPhoto = null;
          } else {
            status = 'absent';
            statusText = 'Absent';
            checkIn = '-';
            checkOut = '-';
            hours = '0.0h';
            checkInPhoto = null;
            checkOutPhoto = null;
          }

          const dayData = {
            date: day,
            fullDate: date,
            status,
            statusText,
            checkIn,
            checkOut,
            hours,
            checkInPhoto,
            checkOutPhoto,
            isWeekend,
            isEmpty: false
          };

          currentWeek.push(dayData);
          
          // If week is complete (7 days) or it's the last day, start a new week
          if (currentWeek.length === 7 || day === lastDay) {
            // Fill remaining slots in the last week with empty cells
            while (currentWeek.length < 7) {
              currentWeek.push(null);
            }
            weeks.push(currentWeek);
            currentWeek = [];
          }
        }

        setCalendarGrid(weeks);
        setIsLoading(false);
      }, 500);
    };

    generateCalendarGrid();
  }, [selectedMonth, selectedYear]);

  // Helper functions
  const isToday = (day) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      selectedMonth === today.getMonth() &&
      selectedYear === today.getFullYear()
    );
  };

  // Show details modal
  const showDayDetails = (dayData) => {
    setSelectedDateDetails(dayData);
    setShowDetailsModal(true);
  };

  // Close details modal
  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedDateDetails(null);
  };

  // Navigation functions
  const goToPreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const goToCurrentMonth = () => {
    const today = new Date();
    setSelectedMonth(today.getMonth());
    setSelectedYear(today.getFullYear());
  };

  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-[#08B8EA] bg-clip-text text-transparent">
            Monthly Calendar
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Track monthly attendance with detailed view</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-900 border-b border-gray-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousMonth}
              className="p-2 rounded-xl hover:bg-gray-800 transition-all hover:scale-110 active:scale-95 bg-gray-900/70 border border-gray-700/50"
            >
              <LeftOutlined className="text-gray-300" />
            </button>

            {/* Month and Year Dropdowns */}
            <div className="flex items-center gap-2">
              <select
                value={monthNames[selectedMonth]}
                onChange={(e) => setSelectedMonth(monthNames.indexOf(e.target.value))}
                className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-lg font-medium focus:outline-none focus:border-[#08B8EA] transition-colors"
              >
                {monthNames.map((month, index) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-lg font-medium focus:outline-none focus:border-[#08B8EA] transition-colors"
              >
                {Array.from({ length: 10 }, (_, i) => selectedYear - 5 + i).map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={goToNextMonth}
              className="p-2 rounded-xl hover:bg-gray-800 transition-all hover:scale-110 active:scale-95 bg-gray-900/70 border border-gray-700/50"
            >
              <RightOutlined className="text-gray-300" />
            </button>

            <button
              onClick={goToCurrentMonth}
              className="ml-2 px-4 py-1.5 text-sm bg-gradient-to-r from-blue-600/80 to-[#08B8EA]/80 hover:from-blue-600 hover:to-[#08B8EA] rounded-xl text-white font-medium transition-all hover:shadow-lg hover:shadow-blue-500/20 hover:scale-105 active:scale-95 border border-blue-500/30"
            >
              Today
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"
            title="Filter"
          >
            <FilterOutlined />
          </button>

          <button
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"
            title="Refresh"
          >
            <ReloadOutlined />
          </button>

          <button
            className="ml-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-[#08B8EA] rounded-lg text-sm font-medium text-white flex items-center gap-1.5"
          >
            <PlusOutlined />
            Mark Attendance
          </button>
        </div>
      </div>

      {/* Calendar Table */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#08B8EA]"></div>
            <span className="ml-3">Loading calendar...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-lg overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-7 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700">
                <div className="p-4 text-center border-r border-gray-700">
                  <span className="text-sm font-bold text-[#08B8EA] uppercase tracking-wider">Date</span>
                </div>
                <div className="p-4 text-center border-r border-gray-700">
                  <span className="text-sm font-bold text-[#08B8EA] uppercase tracking-wider">Day</span>
                </div>
                <div className="p-4 text-center border-r border-gray-700">
                  <span className="text-sm font-bold text-[#08B8EA] uppercase tracking-wider">Status</span>
                </div>
                <div className="p-4 text-center border-r border-gray-700">
                  <span className="text-sm font-bold text-[#08B8EA] uppercase tracking-wider">Check In</span>
                </div>
                <div className="p-4 text-center border-r border-gray-700">
                  <span className="text-sm font-bold text-[#08B8EA] uppercase tracking-wider">Check Out</span>
                </div>
                <div className="p-4 text-center border-r border-gray-700">
                  <span className="text-sm font-bold text-[#08B8EA] uppercase tracking-wider">Hours</span>
                </div>
                <div className="p-4 text-center">
                  <span className="text-sm font-bold text-[#08B8EA] uppercase tracking-wider">Photo</span>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-700">
                {attendanceData.map((record, index) => {
                  const isCurrentDay = isToday(record.date);
                  
                  let rowBgColor = "bg-gray-800";
                  let statusBadgeColor = "";
                  
                  if (record.status === 'present') {
                    statusBadgeColor = "bg-green-600/20 text-green-400 border-green-500/30";
                  } else if (record.status === 'halfday') {
                    statusBadgeColor = "bg-yellow-600/20 text-yellow-400 border-yellow-500/30";
                  } else if (record.status === 'absent') {
                    statusBadgeColor = "bg-red-600/20 text-red-400 border-red-500/30";
                  } else if (record.status === 'weekend') {
                    statusBadgeColor = "bg-blue-600/20 text-blue-400 border-blue-500/30";
                  }

                  if (isCurrentDay) {
                    rowBgColor = "bg-blue-900/20";
                  }

                  return (
                    <div key={index} className={`grid grid-cols-7 ${rowBgColor} hover:bg-gray-700/50 transition-colors`}>
                      {/* Date */}
                      <div className="p-4 text-center border-r border-gray-700 flex items-center justify-center">
                        <span className={`text-xl font-bold ${isCurrentDay ? 'text-[#08B8EA]' : 'text-white'}`}>
                          {record.date}
                        </span>
                      </div>

                      {/* Day */}
                      <div className="p-4 text-center border-r border-gray-700 flex items-center justify-center">
                        <span className="text-white font-medium">
                          {record.day}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="p-4 text-center border-r border-gray-700 flex items-center justify-center">
                        <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${statusBadgeColor}`}>
                          {record.statusText}
                        </span>
                      </div>

                      {/* Check In */}
                      <div className="p-4 text-center border-r border-gray-700 flex items-center justify-center">
                        <span className="text-white font-medium">
                          {record.checkIn}
                        </span>
                      </div>

                      {/* Check Out */}
                      <div className="p-4 text-center border-r border-gray-700 flex items-center justify-center">
                        <span className="text-white font-medium">
                          {record.checkOut}
                        </span>
                      </div>

                      {/* Hours */}
                      <div className="p-4 text-center border-r border-gray-700 flex items-center justify-center">
                        <span className="text-white font-medium">
                          {record.hours}
                        </span>
                      </div>

                      {/* Photo */}
                      <div className="p-4 text-center flex items-center justify-center">
                        {record.hasPhoto ? (
                          <button className="px-3 py-1.5 bg-[#08B8EA] hover:bg-[#08B8EA]/80 rounded-lg text-white text-sm font-medium flex items-center gap-1.5 transition-colors">
                            <EyeOutlined />
                            View
                          </button>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyCalendarTable;
