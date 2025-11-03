import { useState, useEffect, useRef } from "react";
import API from '../services/api';
import { toast } from 'react-toastify';
import InterviewComments from './InterviewComments';
import InterviewHistory from './InterviewHistory';
import { formatDateTime } from '../utils/dateUtils';

function getCurrentDateTimeString() {
  return formatDateTime(new Date());
}

// Currency formatting functions
function formatCurrency(value) {
  if (!value) return '';
  // Remove non-digits
  const numericValue = value.toString().replace(/[^\d]/g, '');
  if (!numericValue) return '';
  
  // Add commas for thousands
  const formatted = numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₹${formatted}`;
}

function parseCurrency(formattedValue) {
  if (!formattedValue) return '';
  // Remove rupee symbol and commas, keep only digits
  return formattedValue.replace(/[₹,]/g, '');
}

function handleCurrencyInput(value, onChange, fieldName) {
  const numericValue = parseCurrency(value);
  onChange(fieldName, numericValue);
}

// Custom Clock Time Picker Component
const ClockTimePicker = ({ value, onChange, onClose, isOpen, className = "" }) => {
  const [hours, setHours] = useState(8);
  const [minutes, setMinutes] = useState(0);
  const [ampm, setAmpm] = useState('AM');
  const [selectingMode, setSelectingMode] = useState('hours'); // 'hours' or 'minutes'
  const [isDragging, setIsDragging] = useState(false);
  const clockRef = useRef(null);

  // Parse initial time value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      const hour24 = parseInt(h);
      const minute = parseInt(m);
      
      setMinutes(minute);
      if (hour24 === 0) {
        setHours(12);
        setAmpm('AM');
      } else if (hour24 === 12) {
        setHours(12);
        setAmpm('PM');
      } else if (hour24 > 12) {
        setHours(hour24 - 12);
        setAmpm('PM');
      } else {
        setHours(hour24);
        setAmpm('AM');
      }
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (clockRef.current && !clockRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleMouseMove = (event) => {
      if (isDragging) {
        handleDrag(event);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isOpen, onClose, isDragging]);

  // Calculate angle for clock hands
  const getSelectedAngle = () => {
    if (selectingMode === 'hours') {
      // Convert 12-hour to angle (12 = 0°, 1 = 30°, 2 = 60°, etc.)
      const hourValue = hours % 12;
      return (hourValue * 30); // 30 degrees per hour, starting from 12 o'clock
    } else {
      return (minutes * 6); // 6 degrees per minute, starting from 12 o'clock
    }
  };

  // Get selected position coordinates
  const getSelectedPosition = () => {
    const angle = getSelectedAngle();
    const radius = selectingMode === 'hours' ? 100 : 120;
    const x = Math.sin(angle * Math.PI / 180) * radius;
    const y = -Math.cos(angle * Math.PI / 180) * radius;
    return { x, y };
  };

  // Handle dragging
  const handleDrag = (event) => {
    const clockElement = document.querySelector('.clock-face');
    if (!clockElement) return;

    const rect = clockElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = event.clientX - centerX;
    const y = event.clientY - centerY;
    
    // Calculate angle from 12 o'clock position
    let angle = Math.atan2(x, -y) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    updateTimeFromAngle(angle);
  };

  // Update time based on angle
  const updateTimeFromAngle = (angle) => {
    if (selectingMode === 'hours') {
      // Convert angle to hour (0° = 12, 30° = 1, 60° = 2, etc.)
      let hourValue = Math.round(angle / 30);
      if (hourValue === 0) hourValue = 12;
      setHours(hourValue);
    } else {
      // Convert angle to minutes (0° = 0, 6° = 1, 12° = 2, etc.)
      let minuteValue = Math.round(angle / 6);
      if (minuteValue === 60) minuteValue = 0;
      setMinutes(minuteValue);
    }
  };

  // Handle clock face clicks
  const handleClockClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = event.clientX - centerX;
    const y = event.clientY - centerY;
    
    // Calculate angle from 12 o'clock position
    let angle = Math.atan2(x, -y) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    updateTimeFromAngle(angle);
  };

  // Handle number click
  const handleNumberClick = (value) => {
    if (selectingMode === 'hours') {
      setHours(value);
    } else {
      setMinutes(value);
    }
  };

  // Handle needle drag start
  const handleNeedleMouseDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  // Handle OK button
  const handleOK = () => {
    // Convert to 24-hour format
    let hour24 = hours;
    if (ampm === 'AM' && hours === 12) {
      hour24 = 0;
    } else if (ampm === 'PM' && hours !== 12) {
      hour24 = hours + 12;
    }

    const timeString = `${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    onChange(timeString);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-2xl overflow-hidden" 
        ref={clockRef}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '400px' }}
      >
        {/* Header with time display */}
        <div className="bg-cyan-500 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 text-2xl font-light leading-none"
          >
            ×
          </button>
          <div className="text-center">
            <div className="text-6xl font-light mb-4 tracking-wider">
              <span 
                className={`cursor-pointer transition-all ${selectingMode === 'hours' ? 'border-b-2 border-white pb-1' : 'opacity-70'}`}
                onClick={() => setSelectingMode('hours')}
              >
                {hours.toString().padStart(2, '0')}
              </span>
              <span className="mx-3 opacity-70">:</span>
              <span 
                className={`cursor-pointer transition-all ${selectingMode === 'minutes' ? 'border-b-2 border-white pb-1' : 'opacity-70'}`}
                onClick={() => setSelectingMode('minutes')}
              >
                {minutes.toString().padStart(2, '0')}
              </span>
            </div>
            <div className="flex justify-center space-x-1">
              <button
                onClick={() => setAmpm('AM')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  ampm === 'AM' ? 'bg-white text-cyan-500 shadow-md' : 'bg-transparent text-white border border-white hover:bg-white hover:text-cyan-500'
                }`}
              >
                AM
              </button>
              <button
                onClick={() => setAmpm('PM')}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  ampm === 'PM' ? 'bg-white text-cyan-500 shadow-md' : 'bg-transparent text-white border border-white hover:bg-white hover:text-cyan-500'
                }`}
              >
                PM
              </button>
            </div>
          </div>
        </div>

        {/* Clock Face */}
        <div className="p-8 bg-white">
          <div 
            className="relative w-80 h-80 mx-auto bg-gray-100 rounded-full cursor-pointer shadow-inner clock-face"
            onClick={handleClockClick}
          >
            {/* Hour/Minute markers */}
            {[...Array(12)].map((_, i) => {
              const value = selectingMode === 'hours' ? (i === 0 ? 12 : i) : i * 5;
              const displayValue = selectingMode === 'hours' ? value : (value === 0 ? '00' : value);
              const angle = i * 30; // 30 degrees per position
              const radius = 140;
              const x = Math.sin(angle * Math.PI / 180) * radius;
              const y = -Math.cos(angle * Math.PI / 180) * radius;
              
              const isSelected = selectingMode === 'hours' 
                ? value === hours 
                : value === minutes;
              
              return (
                <div
                  key={i}
                  className={`absolute w-10 h-10 flex items-center justify-center text-lg font-medium cursor-pointer rounded-full transition-all ${
                    isSelected 
                      ? 'bg-cyan-500 text-white shadow-lg scale-110' 
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                  style={{
                    left: `calc(50% + ${x}px - 20px)`,
                    top: `calc(50% + ${y}px - 20px)`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNumberClick(value);
                  }}
                >
                  {displayValue}
                </div>
              );
            })}

            {/* Center dot */}
            <div 
              className="absolute w-4 h-4 bg-cyan-500 rounded-full z-20" 
              style={{
                left: 'calc(50% - 8px)',
                top: 'calc(50% - 8px)',
              }} 
            />

            {/* Clock hand pointing to selected value - draggable */}
            <div
              className={`absolute bg-cyan-500 origin-bottom z-10 rounded-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={{
                width: '3px',
                height: selectingMode === 'hours' ? '100px' : '120px',
                left: 'calc(50% - 1.5px)',
                top: selectingMode === 'hours' ? 'calc(50% - 100px)' : 'calc(50% - 120px)',
                transform: `rotate(${getSelectedAngle()}deg)`,
                transformOrigin: 'bottom center',
                transition: isDragging ? 'none' : 'transform 0.3s ease-in-out',
              }}
              onMouseDown={handleNeedleMouseDown}
            />

            {/* Selected value circle at the end of the hand - draggable */}
            {(() => {
              const { x, y } = getSelectedPosition();
              return (
                <div
                  className={`absolute w-4 h-4 bg-cyan-500 rounded-full shadow-lg z-30 transition-all ${
                    isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab hover:scale-105'
                  }`}
                  style={{
                    left: `calc(50% + ${x}px - 8px)`,
                    top: `calc(50% + ${y}px - 8px)`,
                    transition: isDragging ? 'none' : 'all 0.3s ease-in-out',
                  }}
                  onMouseDown={handleNeedleMouseDown}
                >
                </div>
              );
            })()}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="p-4 flex justify-end space-x-4 bg-gray-50 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 text-cyan-500 hover:bg-cyan-50 rounded font-medium transition-colors text-sm uppercase tracking-wide"
          >
            CANCEL
          </button>
          <button
            onClick={handleOK}
            className="px-8 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 font-medium transition-colors text-sm uppercase tracking-wide shadow-md"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

// Qualification options
const qualificationOptions = [
  "BELOW 10TH",
  "10TH PASS",
  "12TH PASS",
  "ITI - INDUSTRIAL TRAINING INSTITUTE",
  "D.ED - DIPLOMA IN EDUCATION",
  "D.PHARM - DIPLOMA IN PHARMACY",
  "GNM / ANM - DIPLOMA IN NURSING",
  "B.A - BACHELOR OF ARTS",
  "B.SC - BACHELOR OF SCIENCE",
  "B.COM - BACHELOR OF COMMERCE",
  "B.E / B.TECH - BACHELOR OF ENGINEERING / TECHNOLOGY",
  "BBA - BACHELOR OF BUSINESS ADMINISTRATION",
  "BCA - BACHELOR OF COMPUTER APPLICATIONS",
  "LLB - BACHELOR OF LAWS",
  "MBBS - BACHELOR OF MEDICINE, BACHELOR OF SURGERY",
  "BDS - BACHELOR OF DENTAL SURGERY",
  "BAMS - BACHELOR OF AYURVEDIC MEDICINE AND SURGERY",
  "BHMS - BACHELOR OF HOMEOPATHIC MEDICINE AND SURGERY",
  "B.PHARM - BACHELOR OF PHARMACY",
  "B.ARCH - BACHELOR OF ARCHITECTURE",
  "B.DES - BACHELOR OF DESIGN",
  "BHM - BACHELOR OF HOTEL MANAGEMENT",
  "B.ED - BACHELOR OF EDUCATION",
  "B.P.ED - BACHELOR OF PHYSICAL EDUCATION",
  "BFA - BACHELOR OF FINE ARTS",
  "M.A - MASTER OF ARTS",
  "M.SC - MASTER OF SCIENCE",
  "M.COM - MASTER OF COMMERCE",
  "M.E / M.TECH - MASTER OF ENGINEERING / TECHNOLOGY",
  "MBA - MASTER OF BUSINESS ADMINISTRATION",
  "PGDM - POST GRADUATE DIPLOMA IN MANAGEMENT",
  "MCA - MASTER OF COMPUTER APPLICATIONS",
  "LLM - MASTER OF LAWS",
  "MD - DOCTOR OF MEDICINE",
  "MS - MASTER OF SURGERY",
  "M.PHARM - MASTER OF PHARMACY",
  "M.ARCH - MASTER OF ARCHITECTURE",
  "M.DES - MASTER OF DESIGN",
  "M.ED - MASTER OF EDUCATION",
  "M.PHIL - MASTER OF PHILOSOPHY",
  "PHD - DOCTOR OF PHILOSOPHY",
  "CA - CHARTERED ACCOUNTANT",
  "CS - COMPANY SECRETARY",
  "CMA - COST AND MANAGEMENT ACCOUNTANT",
  "OTHER QUALIFICATION"
];

export default function EditInterview({ interview: initialInterview, onSave, onClose }) {
  // Format interview data for UI
  const formatInterviewForUI = (backendInterview) => {
    // Check if interview data exists
    if (!backendInterview || typeof backendInterview !== 'object') {
      console.error("ERROR: Invalid interview data provided", backendInterview);
      throw new Error("Invalid interview data provided to EditInterview component");
    }
    
    // Try to get a valid ID from various possible fields
    let interviewId = backendInterview._id || backendInterview.id;
    
    // If still no ID, check if this is a display-only scenario
    if (!interviewId) {
      console.warn("No valid ID found in interview data. Interview will be read-only.");
      console.warn("Available keys:", Object.keys(backendInterview));
      
      // Create a read-only flag instead of generating an ID
      interviewId = null;
    }
    
    return {
      id: interviewId, // Will be null if no real ID exists
      _id: interviewId, // Keep both for compatibility
      isReadOnly: !interviewId, // Flag to indicate read-only mode
      createdBy: backendInterview.created_by || "Unknown",
      candidate_name: backendInterview.candidate_name || "",
      mobile_number: backendInterview.mobile_number || "",
      alternate_number: backendInterview.alternate_number || "",
      gender: backendInterview.gender || "Male",
      qualification: backendInterview.qualification || "",
      job_opening: backendInterview.job_opening || "",
      marital_status: backendInterview.marital_status || "",
      age: backendInterview.age || "",
      city: backendInterview.city || "",
      state: backendInterview.state || "",
      experience_type: backendInterview.experience_type || "fresher",
      total_experience: backendInterview.total_experience || "",
      old_salary: backendInterview.old_salary || "",
      offer_salary: backendInterview.offer_salary || "",
      monthly_salary_offered: backendInterview.monthly_salary_offered || "",
      living_arrangement: backendInterview.living_arrangement || "",
      primary_earning_member: backendInterview.primary_earning_member || "",
      type_of_business: backendInterview.type_of_business || "",
      banking_experience: backendInterview.banking_experience || "",
      interview_type: backendInterview.interview_type || "In-Person",
      source_portal: backendInterview.source_portal || "",
      interview_date: backendInterview.interview_date ? 
        new Date(backendInterview.interview_date).toISOString().split('T')[0] : "",
      interview_time: backendInterview.interview_time || "",
      status: backendInterview.status || "new_interview",
      created_by: backendInterview.created_by || "",
      user_id: backendInterview.user_id || ""
    };
  };

  const [interview, setInterview] = useState(formatInterviewForUI(initialInterview));
  const [isOpen, setIsOpen] = useState(true);
  const [currentDateTime, setCurrentDateTime] = useState(getCurrentDateTimeString());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Reschedule state
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  
  // Modal state for comments and history
  const [showComments, setShowComments] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  
  // Loading states for comments and history
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // State for refreshing components
  const [refreshComments, setRefreshComments] = useState(0);
  const [refreshHistory, setRefreshHistory] = useState(0);

  // Clock picker states
  const [showMainTimePicker, setShowMainTimePicker] = useState(false);
  const [showRescheduleTimePicker, setShowRescheduleTimePicker] = useState(false);

  // Toggle functions for comments and history
  const toggleComments = () => {
    setShowComments(!showComments);
    setShowHistory(false);
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
    setShowComments(false);
  };

  // Event handlers for component communication
  useEffect(() => {
    const handleCommentAdded = () => {
      setRefreshHistory(prev => prev + 1); // Refresh history when comment is added
    };

    const handleInterviewUpdated = () => {
      setRefreshHistory(prev => prev + 1); // Refresh history when interview is updated
    };

    // Listen for custom events
    if (!window.customEvents) {
      window.customEvents = new EventTarget();
    }
    
    window.customEvents.addEventListener('commentAdded', handleCommentAdded);
    window.customEvents.addEventListener('interviewUpdated', handleInterviewUpdated);

    return () => {
      window.customEvents.removeEventListener('commentAdded', handleCommentAdded);
      window.customEvents.removeEventListener('interviewUpdated', handleInterviewUpdated);
    };
  }, []);

  // Handle input changes
  const handleInputChange = (field, value) => {
    const oldValue = interview[field];
    
    setInterview(prev => ({
      ...prev,
      [field]: value
    }));

    // Emit event for status changes
    if (field === 'status' && oldValue !== value) {
      if (!window.customEvents) {
        window.customEvents = new EventTarget();
      }
      window.customEvents.dispatchEvent(new CustomEvent('interviewStatusChanged', {
        detail: { interviewId: interview.id, oldStatus: oldValue, newStatus: value }
      }));
    }
  };

  // Handle reschedule
  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      setError("Please select both date and time for rescheduling");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const rescheduleData = {
        interview_date: new Date(rescheduleDate + 'T' + rescheduleTime).toISOString(),
        interview_time: rescheduleTime,
        status: 'rescheduled' // Set to rescheduled status when rescheduling
      };

      console.log("Rescheduling interview with data:", rescheduleData);

      if (!interview.id) {
        throw new Error("Cannot reschedule interview: No valid database ID available.");
      }

      // Call the onSave callback with reschedule data
      await onSave(interview.id, rescheduleData);

      // Emit event for interview update
      if (!window.customEvents) {
        window.customEvents = new EventTarget();
      }
      window.customEvents.dispatchEvent(new CustomEvent('interviewUpdated', {
        detail: { interviewId: interview.id, type: 'reschedule', data: rescheduleData }
      }));

      toast.success(`Interview rescheduled successfully to ${new Date(rescheduleDate + 'T' + rescheduleTime).toLocaleDateString()} at ${rescheduleTime}!`);
      setIsOpen(false);
      onClose();
    } catch (err) {
      console.error("Error rescheduling interview:", err);
      setError(err.message || "Failed to reschedule interview");
      toast.error(err.message || "Failed to reschedule interview");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!interview.candidate_name || !interview.mobile_number || !interview.interview_date) {
        throw new Error("Please fill in all required fields");
      }

      // Detect if interview date has changed
      let newStatus = interview.status;
      const originalDate = initialInterview.interview_date ? new Date(initialInterview.interview_date).toISOString().split('T')[0] : "";
      const newDate = interview.interview_date;
      if (originalDate !== newDate) {
        newStatus = "rescheduled";
      }

      // Format data for API
      const interviewData = {
        candidate_name: interview.candidate_name,
        mobile_number: interview.mobile_number,
        alternate_number: interview.alternate_number || null,
        gender: interview.gender,
        job_opening: interview.job_opening,
        interview_type: interview.interview_type,
        source_portal: interview.source_portal,
        city: interview.city,
        state: interview.state,
        experience_type: interview.experience_type,
        total_experience: interview.total_experience,
        old_salary: interview.old_salary ? parseFloat(interview.old_salary) : null,
        offer_salary: interview.offer_salary ? parseFloat(interview.offer_salary) : null,
        interview_date: new Date(interview.interview_date + 'T' + (interview.interview_time || '00:00')).toISOString(),
        interview_time: interview.interview_time,
        status: newStatus
      };

      console.log("Updating interview with data:", interviewData);

      if (!interview.id) {
        throw new Error("Cannot update interview: No valid database ID available. This interview can only be viewed. Please contact support to update this record.");
      }

      // Check if this is in read-only mode
      if (interview.isReadOnly) {
        throw new Error("Cannot update interview: This interview is in read-only mode due to missing database ID. Please refresh the page and try again.");
      }

      // Call the onSave callback
      await onSave(interview.id, interviewData);

      // Emit event for interview update
      if (!window.customEvents) {
        window.customEvents = new EventTarget();
      }
      window.customEvents.dispatchEvent(new CustomEvent('interviewUpdated', {
        detail: { interviewId: interview.id, type: 'update', data: interviewData }
      }));

      toast.success("Interview updated successfully!");
      setIsOpen(false);
      onClose();
    } catch (err) {
      console.error("Error updating interview:", err);
      setError(err.message || "Failed to update interview");
      toast.error(err.message || "Failed to update interview");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle close
  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent" style={{ backdropFilter: "blur(3px)" }}>
      <div className="relative bg-white p-6 rounded-xl shadow-2xl w-full max-w-5xl mx-auto space-y-6 max-h-[90vh] overflow-y-auto">
        <button
          className="absolute right-2 top-2 text-gray-500 hover:text-red-500 transition text-2xl font-bold"
          onClick={handleClose}
          aria-label="Close"
          type="button"
        >
          ×
        </button>
        <h2 className="text-xl font-bold text-blue-500 mb-4">EDIT INTERVIEW</h2>
        
        <form onSubmit={handleEditSubmit} className="p-8">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {interview.isReadOnly && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
              <strong>Read-Only Mode:</strong> This interview cannot be updated due to missing database ID. You can view the details but cannot make changes.
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1">
                Date & Time
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                value={currentDateTime}
                readOnly
              />
            </div>
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1" htmlFor="createdBy">
                Created By
              </label>
              <input
                id="createdBy"
                type="text"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold bg-gray-100"
                value={interview.createdBy}
                readOnly
              />
            </div>
          </div>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <div className="mt-4">
            <label
              className="block font-bold text-gray-700 mb-1"
              htmlFor="candidate_name"
            >
              Candidate Name
            </label>
            <input
              id="candidate_name"
              type="text"
              className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
              value={interview.candidate_name}
              onChange={(e) => handleInputChange("candidate_name", e.target.value)}
              placeholder="Enter candidate name"
              required
            />
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-4">
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1" htmlFor="mobile_number">
                Mobile Number
              </label>
              <input
                id="mobile_number"
                type="tel"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                value={interview.mobile_number}
                onChange={(e) => handleInputChange("mobile_number", e.target.value)}
                placeholder="Enter mobile number"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1" htmlFor="alternate_number">
                Alternate Number
              </label>
              <input
                id="alternate_number"
                type="tel"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                value={interview.alternate_number}
                onChange={(e) => handleInputChange("alternate_number", e.target.value)}
                placeholder="Enter alternate number"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-4">
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1" htmlFor="gender">
                Gender
              </label>
              <select
                id="gender"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                value={interview.gender}
                onChange={(e) => handleInputChange("gender", e.target.value)}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1" htmlFor="job_opening">
                Job Opening
              </label>
              <input
                id="job_opening"
                type="text"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                value={interview.job_opening}
                onChange={(e) => handleInputChange("job_opening", e.target.value)}
                placeholder="Enter job opening"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-4">
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1" htmlFor="interview_type">
                Interview Type
              </label>
              <select
                id="interview_type"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                value={interview.interview_type}
                onChange={(e) => handleInputChange("interview_type", e.target.value)}
              >
                <option value="">Select Type</option>
                <option value="Phone Call">Phone Call</option>
                <option value="Video Call">Video Call</option>
                <option value="In-Person">In-Person</option>
                <option value="Written Test">Written Test</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1" htmlFor="source_portal">
                Source Portal
              </label>
              <input
                id="source_portal"
                type="text"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                value={interview.source_portal}
                onChange={(e) => handleInputChange("source_portal", e.target.value)}
                placeholder="Enter source portal"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-4">
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1" htmlFor="city">
                City
              </label>
              <input
                id="city"
                type="text"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                value={interview.city}
                onChange={(e) => handleInputChange("city", e.target.value)}
                placeholder="Enter city"
              />
            </div>
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1" htmlFor="state">
                State
              </label>
              <input
                id="state"
                type="text"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                value={interview.state}
                onChange={(e) => handleInputChange("state", e.target.value)}
                placeholder="Enter state"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-4">
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1" htmlFor="experience_type">
                Experience Type
              </label>
              <select
                id="experience_type"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                value={interview.experience_type}
                onChange={(e) => handleInputChange("experience_type", e.target.value)}
              >
                <option value="">Select Experience</option>
                <option value="fresher">Fresher</option>
                <option value="experienced">Experienced</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1" htmlFor="total_experience">
                Total Experience
              </label>
              <input
                id="total_experience"
                type="text"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                value={interview.total_experience}
                onChange={(e) => handleInputChange("total_experience", e.target.value)}
                placeholder="e.g., 2 years"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-4">
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1" htmlFor="old_salary">
                Current Salary
              </label>
              <input
                id="old_salary"
                type="text"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                value={formatCurrency(interview.old_salary)}
                onChange={(e) => handleCurrencyInput(e.target.value, handleInputChange, "old_salary")}
                placeholder="Enter current salary"
              />
            </div>
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1" htmlFor="offer_salary">
                Offered Salary
              </label>
              <input
                id="offer_salary"
                type="text"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                value={formatCurrency(interview.offer_salary)}
                onChange={(e) => handleCurrencyInput(e.target.value, handleInputChange, "offer_salary")}
                placeholder="Enter offered salary"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mt-4">
            <div className="flex-1">
              <label className="block font-bold text-gray-700 mb-1" htmlFor="interview_date">
                Interview Date
              </label>
              <input
                id="interview_date"
                type="date"
                className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                value={interview.interview_date}
                onChange={(e) => handleInputChange("interview_date", e.target.value)}
              />
            </div>
            <div className="flex-1 relative">
              <label className="block font-bold text-gray-700 mb-1" htmlFor="interview_time">
                Interview Time
              </label>
              <div className="relative">
                <input
                  id="interview_time"
                  type="text"
                  readOnly
                  className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 cursor-pointer"
                  value={interview.interview_time ? 
                    (() => {
                      const [h, m] = interview.interview_time.split(':');
                      const hour = parseInt(h);
                      const minute = parseInt(m);
                      const ampm = hour >= 12 ? 'PM' : 'AM';
                      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                      return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
                    })() : 'Click to select time'
                  }
                  onClick={() => setShowMainTimePicker(true)}
                  placeholder="Click to select time"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  🕐
                </div>
                <ClockTimePicker
                  value={interview.interview_time}
                  onChange={(time) => {
                    handleInputChange("interview_time", time);
                    setShowMainTimePicker(false);
                  }}
                  onClose={() => setShowMainTimePicker(false)}
                  isOpen={showMainTimePicker}
                />
              </div>
              <small className="text-gray-500 text-xs mt-1 block">Click to open time picker</small>
            </div>
          </div>

          {/* Reschedule Section */}
          <div className="mt-6 p-4 border-2 border-orange-300 rounded-lg bg-orange-50">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="reschedule_checkbox"
                checked={isRescheduling}
                onChange={(e) => setIsRescheduling(e.target.checked)}
                className="w-4 h-4 text-orange-600 bg-white border-orange-300 rounded focus:ring-orange-500"
              />
              <label htmlFor="reschedule_checkbox" className="text-lg font-bold text-orange-700">
                Reschedule Interview
              </label>
            </div>
            
            {isRescheduling && (
              <>
                <div className="mb-3 p-2 bg-orange-100 rounded border border-orange-200">
                  <p className="text-sm text-orange-800">
                    <strong>Note:</strong> Rescheduling will update the interview date and time, and reset the status to "New Interview".
                  </p>
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block font-bold text-gray-700 mb-1" htmlFor="reschedule_date">
                      New Interview Date *
                    </label>
                    <input
                      id="reschedule_date"
                      type="date"
                      className="w-full px-3 py-2 border border-orange-400 rounded text-black font-bold"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  <div className="flex-1 relative">
                    <label className="block font-bold text-gray-700 mb-1" htmlFor="reschedule_time">
                      New Interview Time *
                    </label>
                    <div className="relative">
                      <input
                        id="reschedule_time"
                        type="text"
                        readOnly
                        className="w-full px-3 py-2 border border-orange-400 rounded text-black font-bold focus:border-orange-500 focus:ring-2 focus:ring-orange-200 cursor-pointer"
                        value={rescheduleTime ? 
                          (() => {
                            const [h, m] = rescheduleTime.split(':');
                            const hour = parseInt(h);
                            const minute = parseInt(m);
                            const ampm = hour >= 12 ? 'PM' : 'AM';
                            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                            return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
                          })() : 'Click to select time'
                        }
                        onClick={() => setShowRescheduleTimePicker(true)}
                        placeholder="Click to select time"
                        required
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        🕐
                      </div>
                      <ClockTimePicker
                        value={rescheduleTime}
                        onChange={(time) => {
                          setRescheduleTime(time);
                          setShowRescheduleTimePicker(false);
                        }}
                        onClose={() => setShowRescheduleTimePicker(false)}
                        isOpen={showRescheduleTimePicker}
                      />
                    </div>
                    <small className="text-gray-500 text-xs mt-1 block">Click to open time picker</small>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-4 mt-6">
            {isRescheduling ? (
              <>
                <button
                  type="button"
                  onClick={handleReschedule}
                  className={`flex-1 px-6 py-3 font-bold rounded-lg shadow transition text-lg ${
                    interview.isReadOnly 
                      ? "bg-gray-400 text-gray-600 cursor-not-allowed" 
                      : "bg-orange-600 text-white hover:bg-orange-700"
                  }`}
                  disabled={isLoading || interview.isReadOnly}
                >
                  {interview.isReadOnly ? "Read-Only Mode" : (isLoading ? "Rescheduling..." : "Reschedule Interview")}
                </button>
                <button
                  type="button"
                  onClick={() => setIsRescheduling(false)}
                  className="flex-1 px-6 py-3 bg-gray-600 text-white font-bold rounded-lg shadow hover:bg-gray-700 transition text-lg"
                >
                  Cancel Reschedule
                </button>
              </>
            ) : (
              <>
                <button
                  type="submit"
                  className={`flex-1 px-6 py-3 font-bold rounded-lg shadow transition text-lg ${
                    interview.isReadOnly 
                      ? "bg-gray-400 text-gray-600 cursor-not-allowed" 
                      : "bg-cyan-600 text-white hover:bg-cyan-700"
                  }`}
                  disabled={isLoading || interview.isReadOnly}
                >
                  {interview.isReadOnly ? "Read-Only Mode" : (isLoading ? "Updating..." : "Update Interview")}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-6 py-3 bg-gray-600 text-white font-bold rounded-lg shadow hover:bg-gray-700 transition text-lg"
                >
                  {interview.isReadOnly ? "Close" : "Cancel"}
                </button>
              </>
            )}
          </div>
        </form>
        
        {/* Comments and History Section - Below the buttons */}
        {interview.id && !interview.isReadOnly && (
          <div className="mt-6 bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex space-x-2 mb-4">
              <button
                type="button"
                className={`px-4 py-2 font-semibold rounded-lg shadow ${showComments ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                onClick={toggleComments}
              >
                ➕ Comments
              </button>
              <button
                type="button"
                className={`px-4 py-2 font-semibold rounded-lg shadow ${showHistory ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                onClick={toggleHistory}
              >
                📋 History
              </button>
            </div>
            
            {/* Comments Section */}
            {showComments && (
              <div className="mt-4">
                {isLoadingComments ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading comments...</p>
                  </div>
                ) : (
                  <InterviewComments
                    interviewId={interview.id}
                    isOpen={true}
                    onClose={() => setShowComments(false)}
                    inline={true}
                    key={refreshComments}
                  />
                )}
              </div>
            )}
            
            {/* History Section */}
            {showHistory && (
              <div className="mt-4">
                {isLoadingHistory ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading history...</p>
                  </div>
                ) : (
                  <InterviewHistory
                    interviewId={interview.id}
                    isOpen={true}
                    onClose={() => setShowHistory(false)}
                    inline={true}
                    key={refreshHistory}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
