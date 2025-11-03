import { useState, useEffect, useRef } from "react";
import API from '../services/api';
import { toast } from 'react-toastify';
import InterviewComments from './InterviewComments';
import InterviewHistory from './InterviewHistory';
import { formatDateTime } from '../utils/dateUtils';

function getCurrentDateTimeString() {
  return formatDateTime(new Date());
}

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

// Custom Clock Time Picker Component
const ClockTimePicker = ({ value, onChange, onClose, isOpen, className = "" }) => {
  const [hours, setHours] = useState(8);
  const [minutes, setMinutes] = useState(0);
  const [ampm, setAmpm] = useState('AM');
  const [selectingMode, setSelectingMode] = useState('hours');
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

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

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
    <div ref={clockRef} className={`bg-white border border-gray-300 rounded-lg shadow-lg p-4 ${className}`}>
      <div className="text-center mb-4">
        <div className="text-2xl font-bold text-gray-800">
          {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')} {ampm}
        </div>
      </div>
      
      <div className="flex items-center justify-center space-x-2 mb-4">
        <button
          type="button"
          onClick={() => setSelectingMode('hours')}
          className={`px-3 py-1 rounded ${selectingMode === 'hours' ? 'bg-cyan-500 text-white' : 'bg-gray-200'}`}
        >
          Hours
        </button>
        <button
          type="button"
          onClick={() => setSelectingMode('minutes')}
          className={`px-3 py-1 rounded ${selectingMode === 'minutes' ? 'bg-cyan-500 text-white' : 'bg-gray-200'}`}
        >
          Minutes
        </button>
      </div>

      <div className="grid grid-cols-6 gap-2 mb-4">
        {selectingMode === 'hours' ? (
          Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
            <button
              key={num}
              type="button"
              onClick={() => setHours(num)}
              className={`p-2 text-center rounded ${hours === num ? 'bg-cyan-500 text-white' : 'hover:bg-gray-200'}`}
            >
              {num}
            </button>
          ))
        ) : (
          [0, 15, 30, 45].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => setMinutes(num)}
              className={`p-2 text-center rounded ${minutes === num ? 'bg-cyan-500 text-white' : 'hover:bg-gray-200'}`}
            >
              {num.toString().padStart(2, '0')}
            </button>
          ))
        )}
      </div>

      <div className="flex justify-center space-x-2 mb-4">
        <button
          type="button"
          onClick={() => setAmpm('AM')}
          className={`px-4 py-2 rounded ${ampm === 'AM' ? 'bg-cyan-500 text-white' : 'bg-gray-200'}`}
        >
          AM
        </button>
        <button
          type="button"
          onClick={() => setAmpm('PM')}
          className={`px-4 py-2 rounded ${ampm === 'PM' ? 'bg-cyan-500 text-white' : 'bg-gray-200'}`}
        >
          PM
        </button>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleOK}
          className="px-6 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600"
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default function EditInterview({ interview: initialInterview, onSave, onClose }) {
  // Format interview data for UI
  const formatInterviewForUI = (backendInterview) => {
    if (!backendInterview || typeof backendInterview !== 'object') {
      throw new Error("Invalid interview data provided to EditInterview component");
    }
    
    let interviewId = backendInterview._id || backendInterview.id;
    
    return {
      id: interviewId,
      _id: interviewId,
      isReadOnly: !interviewId,
      createdBy: backendInterview.created_by || "Unknown",
      candidate_name: backendInterview.candidate_name || "",
      mobile_number: backendInterview.mobile_number || "",
      alternate_number: backendInterview.alternate_number || "",
      gender: backendInterview.gender || "",
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
      interview_type: backendInterview.interview_type || "",
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

  // Handle input changes
  const handleInputChange = (field, value) => {
    setInterview(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle reschedule
  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      toast.error('Please select both date and time for rescheduling');
      return;
    }

    try {
      setIsLoading(true);
      
      const rescheduleData = {
        interview_date: rescheduleDate,
        interview_time: rescheduleTime,
        status: 'new_interview'
      };

      const result = await API.interviews.updateInterview(interview.id, rescheduleData);
      
      setInterview(prev => ({
        ...prev,
        interview_date: rescheduleDate,
        interview_time: rescheduleTime,
        status: 'new_interview'
      }));

      setIsRescheduling(false);
      setRescheduleDate('');
      setRescheduleTime('');
      
      toast.success('Interview rescheduled successfully!');
      
      if (onSave) {
        onSave(result);
      }
    } catch (err) {
      setError(err.message || "Failed to reschedule interview");
      toast.error(err.message || "Failed to reschedule interview");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (interview.isReadOnly) {
      toast.error("Cannot update interview: This interview is in read-only mode");
      return;
    }

    // Basic validation
    if (!interview.candidate_name || !interview.mobile_number || !interview.interview_date) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const interviewData = {
        candidate_name: interview.candidate_name,
        mobile_number: interview.mobile_number,
        alternate_number: interview.alternate_number,
        gender: interview.gender,
        qualification: interview.qualification,
        job_opening: interview.job_opening,
        marital_status: interview.marital_status,
        age: interview.age,
        city: interview.city,
        state: interview.state,
        experience_type: interview.experience_type,
        total_experience: interview.total_experience,
        old_salary: interview.old_salary,
        offer_salary: interview.offer_salary,
        monthly_salary_offered: interview.monthly_salary_offered,
        living_arrangement: interview.living_arrangement,
        primary_earning_member: interview.primary_earning_member,
        type_of_business: interview.type_of_business,
        banking_experience: interview.banking_experience,
        interview_type: interview.interview_type,
        source_portal: interview.source_portal,
        interview_date: interview.interview_date,
        interview_time: interview.interview_time,
        status: interview.status,
        created_by: interview.created_by,
        user_id: interview.user_id
      };

      const result = await API.interviews.updateInterview(interview.id, interviewData);
      
      toast.success('Interview updated successfully!');
      
      if (onSave) {
        onSave(result);
      }
      
      handleClose();
    } catch (err) {
      setError(err.message || "Failed to update interview");
      toast.error(err.message || "Failed to update interview");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] overflow-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 my-8 max-h-[95vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-cyan-600 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Edit Interview</h2>
          <button
            onClick={handleClose}
            className="text-white hover:text-red-200 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Form Container with scrolling */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Header Section with Date & Time and Created By */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
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
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Created By
                </label>
                <input
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

            {/* Candidate Details Section */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-cyan-600">Candidate Details</h3>
              </div>
              
              {/* Row 1: Name, Mobile, Alternate Number */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Candidate Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={interview.candidate_name}
                    onChange={(e) => handleInputChange("candidate_name", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                    placeholder="Enter candidate name"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={interview.mobile_number}
                    onChange={(e) => handleInputChange("mobile_number", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                    placeholder="Enter mobile number"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Alternate Number
                  </label>
                  <input
                    type="tel"
                    value={interview.alternate_number}
                    onChange={(e) => handleInputChange("alternate_number", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                    placeholder="Enter alternate number"
                  />
                </div>
              </div>

              {/* Row 2: Gender, Qualification, Job Applied */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={interview.gender}
                    onChange={(e) => handleInputChange("gender", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                    required
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Qualification <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={interview.qualification}
                    onChange={(e) => handleInputChange("qualification", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                    required
                  >
                    <option value="">Select Qualification</option>
                    {qualificationOptions.map((qualification, index) => (
                      <option key={index} value={qualification}>
                        {qualification}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Job Applied <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={interview.job_opening}
                    onChange={(e) => handleInputChange("job_opening", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                    placeholder="Enter job opening"
                    required
                  />
                </div>
              </div>

              {/* Row 3: Marital Status, Age, City */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Marital Status
                  </label>
                  <select
                    value={interview.marital_status}
                    onChange={(e) => handleInputChange("marital_status", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                  >
                    <option value="">Select status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    value={interview.age}
                    onChange={(e) => handleInputChange("age", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                    placeholder="Enter age"
                    min="18"
                    max="65"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={interview.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                    placeholder="Enter city"
                  />
                </div>
              </div>

              {/* Row 4: Experience Type */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Experience Type
                  </label>
                  <select
                    value={interview.experience_type}
                    onChange={(e) => handleInputChange("experience_type", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                  >
                    <option value="fresher">Fresher</option>
                    <option value="experienced">Experienced</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Family & Living Situation Section */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-cyan-600">Family & Living Situation</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Living Arrangement
                  </label>
                  <select
                    value={interview.living_arrangement}
                    onChange={(e) => handleInputChange("living_arrangement", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                  >
                    <option value="">Select living arrangement</option>
                    <option value="With Family">With Family</option>
                    <option value="PG/Hostel">PG/Hostel</option>
                    <option value="Rented Alone">Rented Alone</option>
                    <option value="Shared Apartment">Shared Apartment</option>
                    <option value="Own House">Own House</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Primary Earning Member
                  </label>
                  <select
                    value={interview.primary_earning_member}
                    onChange={(e) => handleInputChange("primary_earning_member", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                  >
                    <option value="">Select primary earner</option>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Both Parents">Both Parents</option>
                    <option value="Self">Self</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Type of Business/Work
                  </label>
                  <select
                    value={interview.type_of_business}
                    onChange={(e) => handleInputChange("type_of_business", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                  >
                    <option value="">Select work type</option>
                    <option value="Salaried Job">Salaried Job</option>
                    <option value="Government Job">Government Job</option>
                    <option value="Private Business">Private Business</option>
                    <option value="Shop/Retail Business">Shop/Retail Business</option>
                    <option value="Manufacturing Business">Manufacturing Business</option>
                    <option value="Service Business">Service Business</option>
                    <option value="Farming/Agriculture">Farming/Agriculture</option>
                    <option value="Professional Practice">Professional Practice</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Banking/Finance Experience
                  </label>
                  <select
                    value={interview.banking_experience}
                    onChange={(e) => handleInputChange("banking_experience", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                  >
                    <option value="">Select experience</option>
                    <option value="No Experience">No Experience</option>
                    <option value="Loan Sales">Loan Sales</option>
                    <option value="Credit Card Sales">Credit Card Sales</option>
                    <option value="Collection/Recovery">Collection/Recovery</option>
                    <option value="Bank Operations">Bank Operations</option>
                    <option value="Insurance Sales">Insurance Sales</option>
                    <option value="Investment/Mutual Funds">Investment/Mutual Funds</option>
                    <option value="Other Finance">Other Finance</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Interview Details Section */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-cyan-600">Interview Details</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Interview Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={interview.interview_type}
                    onChange={(e) => handleInputChange("interview_type", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                    required
                  >
                    <option value="">Select Interview Type</option>
                    <option value="Phone Call">Phone Call</option>
                    <option value="Video Call">Video Call</option>
                    <option value="In-Person">In-Person</option>
                    <option value="Written Test">Written Test</option>
                    <option value="walk_in">Walk In</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Source/Portal
                  </label>
                  <input
                    type="text"
                    value={interview.source_portal}
                    onChange={(e) => handleInputChange("source_portal", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                    placeholder="Enter source portal"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Monthly Salary Offered
                  </label>
                  <input
                    type="number"
                    value={interview.monthly_salary_offered}
                    onChange={(e) => handleInputChange("monthly_salary_offered", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                    placeholder="Enter monthly salary"
                    step="0.1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Interview Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={interview.interview_date}
                    onChange={(e) => handleInputChange("interview_date", e.target.value)}
                    className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Interview Time <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={interview.interview_time}
                      readOnly
                      onClick={() => setShowMainTimePicker(true)}
                      className="w-full px-3 py-2 border border-cyan-400 rounded text-black font-bold cursor-pointer"
                      placeholder="Click to select time"
                      required
                    />
                    {showMainTimePicker && (
                      <ClockTimePicker
                        isOpen={showMainTimePicker}
                        value={interview.interview_time}
                        onChange={(time) => handleInputChange("interview_time", time)}
                        onClose={() => setShowMainTimePicker(false)}
                        className="absolute top-full left-0 z-50 mt-1"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Reschedule Section */}
            {!isRescheduling && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-yellow-800">Reschedule Interview</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRescheduling(true)}
                    className="px-4 py-2 bg-yellow-500 text-white font-bold rounded hover:bg-yellow-600 transition-colors"
                  >
                    Reschedule
                  </button>
                </div>
              </div>
            )}

            {/* Reschedule Form */}
            {isRescheduling && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-yellow-800">Reschedule Interview</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      New Date
                    </label>
                    <input
                      type="date"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="w-full px-3 py-2 border border-yellow-400 rounded text-black font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      New Time
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={rescheduleTime}
                        readOnly
                        onClick={() => setShowRescheduleTimePicker(true)}
                        className="w-full px-3 py-2 border border-yellow-400 rounded text-black font-bold cursor-pointer"
                        placeholder="Click to select time"
                      />
                      {showRescheduleTimePicker && (
                        <ClockTimePicker
                          isOpen={showRescheduleTimePicker}
                          value={rescheduleTime}
                          onChange={(time) => setRescheduleTime(time)}
                          onClose={() => setShowRescheduleTimePicker(false)}
                          className="absolute top-full left-0 z-50 mt-1"
                        />
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-yellow-100 border border-yellow-300 rounded p-3 mb-4">
                  <p className="text-yellow-800 text-sm">
                    <strong>Note:</strong> Rescheduling will update the interview date and time, and reset the status to "New Interview".
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleReschedule}
                    className="px-4 py-2 bg-yellow-500 text-white font-bold rounded hover:bg-yellow-600 transition-colors"
                    disabled={!rescheduleDate || !rescheduleTime}
                  >
                    Confirm Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRescheduling(false);
                      setRescheduleDate('');
                      setRescheduleTime('');
                    }}
                    className="px-4 py-2 bg-gray-500 text-white font-bold rounded hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

          </form>
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-6 py-3 bg-gray-500 text-white font-bold rounded shadow-md hover:bg-gray-600 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isLoading || interview.isReadOnly}
              className={`flex-1 px-6 py-3 font-bold rounded shadow-md transition-colors duration-200 ${
                interview.isReadOnly 
                  ? "bg-gray-400 text-gray-600 cursor-not-allowed" 
                  : isLoading
                  ? "bg-cyan-400 text-white cursor-not-allowed"
                  : "bg-cyan-500 text-white hover:bg-cyan-600"
              }`}
            >
              {interview.isReadOnly ? "Read-Only Mode" : (isLoading ? "Updating..." : "Update Interview")}
            </button>
          </div>
        </div>

        {/* Comments and History Section - Below the buttons */}
        {interview.id && !interview.isReadOnly && (
          <div className="border-t border-gray-200 bg-white">
            <div className="px-6 py-4">
              <div className="flex space-x-2 mb-4">
                <button
                  type="button"
                  onClick={toggleComments}
                  className={`px-4 py-2 rounded font-semibold transition ${
                    showComments 
                      ? 'bg-cyan-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Comments
                </button>
                <button
                  type="button"
                  onClick={toggleHistory}
                  className={`px-4 py-2 rounded font-semibold transition ${
                    showHistory 
                      ? 'bg-cyan-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  History
                </button>
              </div>

              {showComments && (
                <div className="max-h-60 overflow-y-auto">
                  <InterviewComments 
                    interviewId={interview.id}
                    refresh={refreshComments}
                    onCommentAdded={() => setRefreshHistory(prev => prev + 1)}
                  />
                </div>
              )}

              {showHistory && (
                <div className="max-h-60 overflow-y-auto">
                  <InterviewHistory 
                    interviewId={interview.id}
                    refresh={refreshHistory}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
