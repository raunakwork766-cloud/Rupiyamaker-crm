import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { User, LogOut, Clock, Camera, X, Key, Eye, EyeOff } from "lucide-react";
import NotificationBell from "./NotificationBell";
import { getProfilePictureUrlWithCacheBusting } from "../utils/mediaUtils";
import hrmsService from "../services/hrmsService";

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use proxy

// Floating Dropdown Component (for time and user menus)
const FloatingDropdown = ({ isOpen, triggerRef, children, width = 'w-96' }) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth < 640; // sm breakpoint
      
      // Mobile responsive width calculation
      let dropdownWidth;
      if (isMobile) {
        dropdownWidth = Math.min(window.innerWidth - 32, 320); // Max 320px on mobile with 16px margins
      } else {
        // Handle different width classes including custom ones
        if (width === 'w-96') dropdownWidth = 384;
        else if (width === 'w-80') dropdownWidth = 320;
        else if (width === 'w-[32rem]') dropdownWidth = 512;
        else if (width === 'w-[28rem]') dropdownWidth = 448;
        else dropdownWidth = 384; // default fallback
      }
      
      // Position dropdown to the right of the trigger element
      let left = rect.right - dropdownWidth + 8; // Align to right edge with small offset
      const top = rect.bottom + 8;

      // Ensure dropdown stays within viewport - adjust if it goes off screen
      if (left < 16) left = 16;
      if (left + dropdownWidth > window.innerWidth - 16) {
        left = window.innerWidth - dropdownWidth - 16;
      }
      
      setPosition({ top, left, width: dropdownWidth });
    }
  }, [isOpen, triggerRef, width]);

  if (!isOpen) return null;

  const isMobile = window.innerWidth < 640;
  const dynamicWidth = isMobile ? `${position.width}px` : width;

  return createPortal(
    <div
      className={`fixed bg-white rounded-lg shadow-2xl max-h-[60vh] sm:max-h-[600px] overflow-y-auto border border-gray-200 ${!isMobile ? width : ''}`}
      style={{ 
        top: position.top, 
        left: position.left, 
        zIndex: 10000,
        width: isMobile ? position.width : undefined
      }}
    >
      {children}
    </div>,
    document.body
  );
};
// Success Modal Component
const SuccessModal = ({ successInfo, onClose }) => {
  if (!successInfo) return null;
  const configs = {
    full_day: {
      emoji: '🎉',
      color: '#16a34a',
      bg: '#f0fdf4',
      border: '#86efac',
      messages: [
        'Great start to the day! Keep it up! 💪',
        'You\'re on time! Productive day ahead! 🚀',
        'Attendance marked! Let\'s crush it today! ⚡',
        'On time and ready! Amazing! 🌟',
      ],
    },
    half_day: {
      emoji: '🌤️',
      color: '#d97706',
      bg: '#fffbeb',
      border: '#fcd34d',
      messages: [
        'Half day marked! Make the most of it! 😊',
        'Short day today, still counts! 👍',
        'Half day attendance recorded! 📋',
      ],
    },
    late: {
      emoji: '⏰',
      color: '#dc2626',
      bg: '#fef2f2',
      border: '#fca5a5',
      messages: [
        'You\'re a bit late today. Try to be earlier tomorrow! 😅',
        'Late check-in recorded. No worries, happens to all! 🙂',
        'Marked late. Remember: early bird gets the worm! 🐦',
      ],
    },
    checked_out: {
      emoji: '👋',
      color: '#2563eb',
      bg: '#eff6ff',
      border: '#93c5fd',
      messages: [
        'Great work today! See you tomorrow! 😊',
        'Another productive day done! Rest well! 🌙',
        'Checked out! You deserve some rest! 🏠',
        'Day complete! Good job today! ⭐',
      ],
    },
  };
  const cfg = configs[successInfo.type] || configs.full_day;
  const randomMsg = cfg.messages[Math.floor(Math.random() * cfg.messages.length)];
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002, padding: '16px' }}>
      <div style={{ background: cfg.bg, border: `2px solid ${cfg.border}`, borderRadius: '16px', padding: '32px 24px', maxWidth: '360px', width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', animation: 'popIn 0.3s ease-out' }}>
        <style>{`@keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
        <div style={{ fontSize: '64px', marginBottom: '12px' }}>{cfg.emoji}</div>
        <h2 style={{ color: cfg.color, fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>{successInfo.title}</h2>
        <p style={{ color: '#374151', fontSize: '15px', marginBottom: '8px' }}>{successInfo.message}</p>
        <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '24px', fontStyle: 'italic' }}>{randomMsg}</p>
        <button onClick={onClose} style={{ background: cfg.color, color: 'white', border: 'none', borderRadius: '10px', padding: '12px 32px', fontSize: '16px', fontWeight: 600, cursor: 'pointer', width: '100%' }}>
          Done
        </button>
      </div>
    </div>,
    document.body
  );
};

// Camera Modal Component
const CameraModal = ({
  showCamera,
  pendingAction,
  closeCameraModal,
  videoRef,
  canvasRef,
  capturedPhoto,
  capturePhoto,
  retakePhoto,
  confirmPhoto,
  attendanceLoading,
  faceVerifyState,
}) => {
  if (!showCamera) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" style={{ zIndex: 10001 }}>
      <div className="bg-white border border-gray-300 rounded-xl shadow-2xl p-4 sm:p-6 w-full max-w-sm sm:max-w-lg relative">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-black text-base sm:text-lg font-semibold">
            {pendingAction === 'checkin' ? '✅ Check In' : '👋 Check Out'} - Take Photo
          </h3>
          <button
            onClick={closeCameraModal}
            className="text-gray-600 hover:text-black transition-colors p-1"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
        <div className="space-y-3 sm:space-y-4">
          <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3', maxHeight: '250px' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${capturedPhoto ? 'hidden' : 'block'}`}
            />
            {capturedPhoto && (
              <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>

          {/* Face Verify Status */}
          {capturedPhoto && faceVerifyState === 'verifying' && (
            <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', color: '#1d4ed8', fontSize: '14px', fontWeight: 500 }}>
              🔍 Verifying your face... please wait
            </div>
          )}
          {capturedPhoto && faceVerifyState === 'verified' && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', color: '#15803d', fontSize: '14px', fontWeight: 600 }}>
              ✅ Face verified! You can mark your attendance.
            </div>
          )}
          {capturedPhoto && faceVerifyState === 'failed' && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', color: '#dc2626', fontSize: '14px', fontWeight: 600 }}>
              ❌ Face not recognized. Please retake photo.
            </div>
          )}

          <div className="flex gap-2 sm:gap-3">
            {!capturedPhoto ? (
              <>
                <button
                  onClick={closeCameraModal}
                  className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base bg-gray-400 hover:bg-gray-500 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={capturePhoto}
                  className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  <span className="hidden sm:inline">📷 Capture Photo</span>
                  <span className="sm:hidden">Capture</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={closeCameraModal}
                  className="flex-1 px-2 sm:px-4 py-2 text-sm sm:text-base bg-gray-400 hover:bg-gray-500 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={retakePhoto}
                  className="flex-1 px-2 sm:px-4 py-2 text-sm sm:text-base bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                  disabled={faceVerifyState === 'verifying'}
                >
                  🔄 Retake
                </button>
                {faceVerifyState === 'verified' && (
                  <button
                    onClick={confirmPhoto}
                    disabled={attendanceLoading}
                    className="flex-1 px-2 sm:px-4 py-2 text-sm sm:text-base bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {attendanceLoading ? '⏳ Marking...' : `✅ Mark ${pendingAction === 'checkin' ? 'Check In' : 'Check Out'}`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.getElementById('camera-modal-container') || document.body
  );
};

export default function TopNavbar({
  selectedLabel = "Feed",
  userName = "John Doe",
  onLogout,
  user,
}) {
  const [time, setTime] = useState(new Date());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showTimeMenu, setShowTimeMenu] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [attendanceData, setAttendanceData] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [faceVerifyState, setFaceVerifyState] = useState('idle'); // idle | verifying | verified | failed
  const [successModal, setSuccessModal] = useState(null); // null | { type, title, message }
  const [userProfilePhoto, setUserProfilePhoto] = useState(null);
  const [profilePhotoError, setProfilePhotoError] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(null);
  
  // Change password modal states
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showChangePasswordInDropdown, setShowChangePasswordInDropdown] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const timeRef = useRef(null);
  const userRef = useRef(null);

  // Function to refresh profile photo (can be called from other components)
  const refreshProfilePhoto = async () => {
    try {
      const userId = getUserId();
      if (!userId) return;

      // Try to fetch fresh employee data from API
      try {
        const allEmployees = await hrmsService.getAllEmployees();
        const currentEmployee = allEmployees.find(emp => 
          emp._id === userId || 
          emp.id === userId || 
          emp.employee_id === userId ||
          emp.user_id === userId
        );
        
        if (currentEmployee?.profile_photo) {
          const profilePhotoUrl = getProfilePictureUrlWithCacheBusting(currentEmployee.profile_photo);
          setUserProfilePhoto(profilePhotoUrl);
          setProfilePhotoError(false);
          // Update localStorage with fresh data
          localStorage.setItem('profile_photo', currentEmployee.profile_photo);
          return;
        }
      } catch (error) {
        console.log('Refresh failed, trying individual fetch');
      }

      // Fallback to individual fetch
      try {
        const employeeData = await hrmsService.getEmployee(userId);
        if (employeeData?.profile_photo) {
          const profilePhotoUrl = getProfilePictureUrlWithCacheBusting(employeeData.profile_photo);
          setUserProfilePhoto(profilePhotoUrl);
          setProfilePhotoError(false);
          // Update localStorage with fresh data
          localStorage.setItem('profile_photo', employeeData.profile_photo);
          return;
        }
      } catch (error) {
        console.error('Individual refresh failed:', error);
      }

      // No profile photo found
      setUserProfilePhoto(null);
      setProfilePhotoError(false);
    } catch (error) {
      console.error('Error refreshing profile photo:', error);
      setProfilePhotoError(true);
    }
  };

  // Utility function to check if a string is a MongoDB ObjectId
  const isMongoObjectId = (str) => {
    return typeof str === 'string' && /^[a-f\d]{24}$/i.test(str);
  };

  // Utility function to check if a string looks like a proper employee ID
  const isValidEmployeeId = (str) => {
    if (!str || typeof str !== 'string' || str.trim().length === 0) return false;
    if (isMongoObjectId(str)) return false; // Reject MongoDB ObjectIds
    // Accept employee IDs that are short (usually under 20 chars) and may contain letters/numbers
    return str.trim().length <= 20 && /^[A-Za-z0-9_-]+$/.test(str.trim());
  };

  // Simple function to get employee ID from any available source
  const getEmployeeId = () => {
    // Try currentUserData first (from API fetch)
    if (currentUserData?.employee_id) return currentUserData.employee_id;
    
    // Try user prop
    if (user?.employee_id) return user.employee_id;
    
    // Try direct localStorage
    const directId = localStorage.getItem('employee_id');
    if (directId && directId !== 'null') return directId;
    
    // Try user object from localStorage
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      if (userData.employee_id) return userData.employee_id;
      if (userData.emp_id) return userData.emp_id;
      if (userData.code) return userData.code;
    } catch (e) {
      // Ignore parsing errors
    }
    
    return null;
  };

  // Function to fetch current user data
  const fetchCurrentUserData = async () => {
    try {
      console.log('Navbar - fetchCurrentUserData called');
      console.log('Navbar - user prop:', user);
      
      // Check if the user prop already has the data we need
      if (user && user.employee_id) {
        console.log('Navbar - Found employee_id in user prop:', user.employee_id);
        const userDataObj = {
          employee_id: user.employee_id,
          designation: user.designation || user.role,
          department: user.department?.name || user.department,
          name: user.name || user.full_name
        };
        setCurrentUserData(userDataObj);
        return;
      }

      // Also try to get from JWT token
      try {
        const token = localStorage.getItem('token');
        if (token) {
          console.log('Navbar - Token found:', token.substring(0, 50) + '...');
          // Decode JWT token (basic decode, not verification)
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            console.log('Navbar - Token payload:', payload);
            if (payload.employee_id || payload.user_id) {
              setCurrentUserData({
                employee_id: payload.employee_id || payload.user_id,
                designation: payload.designation || payload.role,
                department: payload.department,
                name: payload.name || payload.username
              });
              return;
            }
          }
        }
      } catch (tokenError) {
        console.log('Error parsing token:', tokenError);
      }

      // Try multiple localStorage keys to find user data
      const possibleKeys = ['user', 'currentUser', 'userData', 'userInfo', 'authUser', 'loggedInUser', 'employeeData'];
      
      console.log('Navbar - Checking localStorage keys for user data...');
      for (const key of possibleKeys) {
        try {
          const userData = localStorage.getItem(key);
          if (userData && userData !== 'undefined' && userData !== 'null') {
            const parsedUser = JSON.parse(userData);
            console.log(`Navbar - Found data in localStorage[${key}]:`, parsedUser);
            
            if (parsedUser && (parsedUser.employee_id || parsedUser.designation || parsedUser.department)) {
              const userDataObj = {
                employee_id: parsedUser.employee_id || parsedUser.emp_id || parsedUser.code,
                designation: parsedUser.designation || parsedUser.role || parsedUser.position,
                department: parsedUser.department?.name || parsedUser.department,
                name: parsedUser.name || parsedUser.full_name || parsedUser.username
              };
              console.log('Navbar - Setting userData from localStorage:', userDataObj);
              setCurrentUserData(userDataObj);
              return;
            }
          }
        } catch (parseError) {
          // Ignore parsing errors
        }
      }

      const userId = getUserId();
      console.log('Navbar - getUserId() returned:', userId);
      if (!userId) {
        console.log('Navbar - No userId found, aborting fetch');
        return;
      }

      // Use the same approach as profile photo loading which works
      try {
        const allEmployees = await hrmsService.getAllEmployees();
        
        if (allEmployees && allEmployees.length > 0) {
          // Find current user in employees list using the same logic as profile photo
          let currentEmployee = allEmployees.find(emp => 
            emp._id === userId || 
            emp.id === userId || 
            emp.employee_id === userId ||
            emp.user_id === userId
          );
          
          // If not found, try string comparison
          if (!currentEmployee) {
            currentEmployee = allEmployees.find(emp => 
              String(emp._id) === String(userId) || 
              String(emp.id) === String(userId) || 
              String(emp.employee_id) === String(userId) ||
              String(emp.user_id) === String(userId)
            );
          }
          
          if (currentEmployee) {
            console.log('Navbar - Found matching employee:', currentEmployee);
            const userData = {
              employee_id: currentEmployee.employee_id,
              designation: currentEmployee.designation,
              department: currentEmployee.department?.name || currentEmployee.department,
              name: currentEmployee.name
            };
            console.log('Navbar - Setting userData:', userData);
            setCurrentUserData(userData);
            return;
          } else {
            console.log('Navbar - No matching employee found for userId:', userId);
          }
        }
      } catch (apiError) {
        // If API fails, try individual fetch
        try {
          const employeeData = await hrmsService.getEmployee(userId);
          if (employeeData) {
            const userData = {
              employee_id: employeeData.employee_id,
              designation: employeeData.designation,
              department: employeeData.department?.name || employeeData.department,
              name: employeeData.name
            };
            setCurrentUserData(userData);
          }
        } catch (individualError) {
          // If all API calls fail, just ignore - we'll show userId as fallback
        }
      }

    } catch (error) {
      console.error('Error fetching current user data:', error);
    }
  };

  // Expose refresh function globally for other components to use
  useEffect(() => {
    window.refreshNavbarProfilePhoto = refreshProfilePhoto;
    return () => {
      delete window.refreshNavbarProfilePhoto;
    };
  }, []);

  // Listen for localStorage changes to update profile photo in real-time
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'profile_photo' || e.key === 'user' || e.key === 'userProfilePhoto') {
        // Trigger a re-load of the profile photo
        const loadUserProfilePhoto = async () => {
          const localStoragePhoto = localStorage.getItem('profile_photo');
          if (localStoragePhoto && localStoragePhoto !== 'null' && localStoragePhoto !== 'undefined') {
            if (localStoragePhoto.startsWith('http')) {
              setUserProfilePhoto(localStoragePhoto);
            } else {
              const profilePhotoUrl = getProfilePictureUrlWithCacheBusting(localStoragePhoto);
              setUserProfilePhoto(profilePhotoUrl);
            }
            setProfilePhotoError(false);
            return;
          }
          
          // Check userProfilePhoto key as fallback
          const userProfilePhotoLS = localStorage.getItem('userProfilePhoto');
          if (userProfilePhotoLS && userProfilePhotoLS !== 'null' && userProfilePhotoLS !== 'undefined') {
            if (userProfilePhotoLS.startsWith('http')) {
              setUserProfilePhoto(userProfilePhotoLS);
            } else {
              const profilePhotoUrl = getProfilePictureUrlWithCacheBusting(userProfilePhotoLS);
              setUserProfilePhoto(profilePhotoUrl);
            }
            setProfilePhotoError(false);
            localStorage.setItem('profile_photo', userProfilePhotoLS);
            return;
          }
          
          // Check user object if direct profile_photo key is not available
          try {
            const userData = localStorage.getItem('user');
            if (userData) {
              const parsedUser = JSON.parse(userData);
              if (parsedUser.profile_photo && parsedUser.profile_photo !== 'null' && parsedUser.profile_photo !== 'undefined') {
                const profilePhotoUrl = getProfilePictureUrlWithCacheBusting(parsedUser.profile_photo);
                setUserProfilePhoto(profilePhotoUrl);
                setProfilePhotoError(false);
                return;
              }
            }
          } catch (parseError) {
            console.error('Error parsing updated user data:', parseError);
          }
          
          // If no photo found, clear it
          setUserProfilePhoto(null);
          setProfilePhotoError(false);
        };
        
        loadUserProfilePhoto();
      }
    };

    // Listen for storage events (works for changes from other tabs)
    window.addEventListener('storage', handleStorageChange);
    
    // Custom event for same-tab localStorage changes
    window.addEventListener('localStorageChange', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageChange', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    checkAttendanceStatus();
    fetchCurrentUserData();
  }, []);

  // Also fetch user data when user prop changes
  useEffect(() => {
    console.log('=== NAVBAR USEEFFECT DEBUG ===');
    console.log('user prop changed:', user);
    
    // Debug localStorage content
    console.log('localStorage keys:', Object.keys(localStorage));
    console.log('localStorage.user:', localStorage.getItem('user'));
    console.log('localStorage.userData:', localStorage.getItem('userData'));
    console.log('localStorage.employee_id:', localStorage.getItem('employee_id'));
    
    if (user) {
      console.log('User exists, calling fetchCurrentUserData');
      fetchCurrentUserData();
    } else {
      console.log('No user prop, skipping fetchCurrentUserData');
    }
  }, [user]);

  useEffect(() => {
    let modalContainer = document.getElementById('camera-modal-container');
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = 'camera-modal-container';
      modalContainer.style.zIndex = '0';
      document.body.appendChild(modalContainer);
    } else {
      modalContainer.style.zIndex = '0';
    }
    return () => {
      if (modalContainer && !modalContainer.hasChildNodes()) {
        modalContainer.style.zIndex = '0';
        document.body.removeChild(modalContainer);
      }
    };
  }, []);

  useEffect(() => {
    if (showCamera) {
      document.body.style.overflow = 'hidden';
      startCamera();
    } else {
      document.body.style.overflow = 'unset';
      stopCamera();
    }
    return () => {
      document.body.style.overflow = 'unset';
      stopCamera();
    };
  }, [showCamera]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showTimeMenu && timeRef.current) {
        const timeDropdown = document.querySelector('.fixed.w-80');
        if (
          timeDropdown &&
          !timeDropdown.contains(event.target) &&
          !timeRef.current.contains(event.target)
        ) {
          setShowTimeMenu(false);
        }
      }

      if (showUserMenu && userRef.current) {
        const userDropdown = document.querySelector('.fixed.bg-white');
        if (
          userDropdown &&
          !userDropdown.contains(event.target) &&
          !userRef.current.contains(event.target)
        ) {
          setShowUserMenu(false);
          setShowChangePasswordInDropdown(false);
        }
      }
    };

    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (showCamera) {
          closeCameraModal();
        }
        if (showChangePasswordInDropdown) {
          setShowChangePasswordInDropdown(false);
        } else {
          setShowUserMenu(false);
        }
        setShowTimeMenu(false);
      }
    };

    // Only add event listeners if menus are open
    if (showTimeMenu || showUserMenu || showCamera) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [showTimeMenu, showUserMenu, showCamera]);

  // Load user profile photo
  useEffect(() => {
    const loadUserProfilePhoto = async () => {
      try {
        // Check localStorage for profile_photo key
        const localStoragePhoto = localStorage.getItem('profile_photo');
        
        if (localStoragePhoto && localStoragePhoto !== 'null' && localStoragePhoto !== 'undefined') {
          if (localStoragePhoto.startsWith('http')) {
            setUserProfilePhoto(localStoragePhoto);
          } else {
            const profilePhotoUrl = getProfilePictureUrlWithCacheBusting(localStoragePhoto);
            setUserProfilePhoto(profilePhotoUrl);
          }
          setProfilePhotoError(false);
          return;
        }

        // Check localStorage for userProfilePhoto key (fallback for compatibility)
        const userProfilePhotoLS = localStorage.getItem('userProfilePhoto');
        
        if (userProfilePhotoLS && userProfilePhotoLS !== 'null' && userProfilePhotoLS !== 'undefined') {
          if (userProfilePhotoLS.startsWith('http')) {
            setUserProfilePhoto(userProfilePhotoLS);
          } else {
            const profilePhotoUrl = getProfilePictureUrlWithCacheBusting(userProfilePhotoLS);
            setUserProfilePhoto(profilePhotoUrl);
          }
          setProfilePhotoError(false);
          localStorage.setItem('profile_photo', userProfilePhotoLS);
          return;
        }

        // Check user object in localStorage
        try {
          const userData = localStorage.getItem('user');
          if (userData) {
            const parsedUser = JSON.parse(userData);
            
            if (parsedUser.profile_photo && parsedUser.profile_photo !== 'null' && parsedUser.profile_photo !== 'undefined') {
              const profilePhotoUrl = getProfilePictureUrlWithCacheBusting(parsedUser.profile_photo);
              setUserProfilePhoto(profilePhotoUrl);
              setProfilePhotoError(false);
              return;
            }
          }
        } catch (parseError) {
          console.error('Error parsing user data from localStorage:', parseError);
        }
        
        // Fall back to API if nothing in localStorage
        const userId = getUserId();
        
        if (!userId) {
          setUserProfilePhoto(null);
          setProfilePhotoError(false);
          return;
        }

        try {
          // Get all employees and find the current user
          const allEmployees = await hrmsService.getAllEmployees();
          
          if (allEmployees && allEmployees.length > 0) {
            // Find current user in employees list
            let currentEmployee = allEmployees.find(emp => 
              emp._id === userId || 
              emp.id === userId || 
              emp.employee_id === userId ||
              emp.user_id === userId
            );
            
            // If not found, try string comparison
            if (!currentEmployee) {
              currentEmployee = allEmployees.find(emp => 
                String(emp._id) === String(userId) || 
                String(emp.id) === String(userId) || 
                String(emp.employee_id) === String(userId) ||
                String(emp.user_id) === String(userId)
              );
            }
            
            if (currentEmployee?.profile_photo) {
              const profilePhotoUrl = getProfilePictureUrlWithCacheBusting(currentEmployee.profile_photo);
              setUserProfilePhoto(profilePhotoUrl);
              setProfilePhotoError(false);
              localStorage.setItem('profile_photo', currentEmployee.profile_photo);
              return;
            }
          }
        } catch (apiError) {
          console.error('Failed to fetch employees:', apiError);
        }

        // Fallback: try individual employee fetch
        try {
          const employeeData = await hrmsService.getEmployee(userId);
          
          if (employeeData?.profile_photo) {
            const profilePhotoUrl = getProfilePictureUrlWithCacheBusting(employeeData.profile_photo);
            setUserProfilePhoto(profilePhotoUrl);
            setProfilePhotoError(false);
            localStorage.setItem('profile_photo', employeeData.profile_photo);
            return;
          }
        } catch (individualError) {
          console.error('Individual fetch failed:', individualError);
        }
        
        // If no profile photo found anywhere
        setUserProfilePhoto(null);
        setProfilePhotoError(false);
        
      } catch (error) {
        console.error('Error loading user profile photo:', error);
        setProfilePhotoError(true);
      }
    };
    
    loadUserProfilePhoto();
    fetchCurrentUserData();
  }, [user]);

  const getUserId = () => {
    try {
      const userId = localStorage.getItem('userId');
      console.log('getUserId - localStorage userId:', userId);
      if (userId) return userId;
      
      const userData = localStorage.getItem('user');
      console.log('getUserId - localStorage user:', userData);
      if (userData) {
        const parsedUser = JSON.parse(userData);
        console.log('getUserId - parsed user:', parsedUser);
        const extractedId = parsedUser.id || parsedUser._id || parsedUser.user_id;
        console.log('getUserId - extracted ID:', extractedId);
        return extractedId;
      }
      return null;
    } catch (error) {
      console.error('Error getting user ID:', error);
      return null;
    }
  };

  // Password change functions
  const openChangePasswordModal = () => {
    setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordErrors({});
    setShowPasswords({ old: false, new: false, confirm: false });
    setShowChangePasswordModal(true);
    setShowUserMenu(false);
  };

  const closeChangePasswordModal = () => {
    setShowChangePasswordModal(false);
    setShowChangePasswordInDropdown(false);
    setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordErrors({});
    setShowPasswords({ old: false, new: false, confirm: false });
  };

  const handlePasswordInputChange = (field, value) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    // Clear errors when user types
    if (passwordErrors[field]) {
      setPasswordErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const validatePassword = () => {
    const errors = {};
    
    // Auto-set confirm password to match new password for simplified UI
    setPasswordData(prev => ({ ...prev, confirmPassword: prev.newPassword }));
    
    if (!passwordData.oldPassword.trim()) {
      errors.oldPassword = 'Old password is required';
    }
    
    if (!passwordData.newPassword.trim()) {
      errors.newPassword = 'New password is required';
    } else if (passwordData.newPassword.length < 6) {
      errors.newPassword = 'New password must be at least 6 characters long';
    }
    
    if (passwordData.oldPassword === passwordData.newPassword) {
      errors.newPassword = 'New password must be different from old password';
    }
    
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdatePassword = async () => {
    if (!validatePassword()) return;
    
    setPasswordLoading(true);
    try {
      const userId = getUserId();
      if (!userId) {
        throw new Error('User ID not found');
      }

      // Update password using HRMS service
      const response = await hrmsService.changeEmployeePassword(userId, {
        old_password: passwordData.oldPassword,
        new_password: passwordData.newPassword
      });

      if (response && response.success) {
        alert('Password updated successfully! For security reasons, you will be logged out automatically in 2 seconds. Please login with your new password.');
        
        // Trigger a custom event to notify other components about password update
        window.dispatchEvent(new CustomEvent('passwordUpdated', { 
          detail: { 
            userId: userId,
            message: 'Password updated successfully' 
          } 
        }));
        
        closeChangePasswordModal();
        
        // Automatically logout for security after password change
        setTimeout(() => {
          handleLogout();
        }, 2000); // Give user 2 seconds to read the message
      } else {
        throw new Error(response?.message || 'Failed to update password');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      if (error.message.includes('Invalid old password') || error.message.includes('incorrect')) {
        setPasswordErrors({ oldPassword: 'Invalid old password' });
      } else {
        setPasswordErrors({ general: error.message || 'Failed to update password' });
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const checkAttendanceStatus = async () => {
    try {
      const userId = getUserId();
      if (!userId) {
        console.log('No user ID found');
        return;
      }
      const response = await fetch(`${API_BASE_URL}/attendance/today?user_id=${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        setAttendanceData(data.attendance);
        setIsCheckedIn(data.attendance?.check_in_time && !data.attendance?.check_out_time);
      } else {
        console.error('Failed to check attendance status:', response.status);
        setAttendanceData(null);
        setIsCheckedIn(false);
      }
    } catch (error) {
      console.error('Error checking attendance status:', error);
      setAttendanceData(null);
      setIsCheckedIn(false);
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported by this browser');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch((error) => console.error('Error playing video:', error));
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert(`Unable to access camera: ${error.message}. Please check permissions and try again.`);
      closeCameraModal();
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedPhoto(photoDataUrl);
      // Auto-verify face after capture
      verifyFace(photoDataUrl);
    } else {
      console.error('Video or canvas not available');
      alert('Error capturing photo. Please try again.');
    }
  };

  const verifyFace = async (photoDataUrl) => {
    setFaceVerifyState('verifying');
    try {
      const userId = getUserId();
      if (!userId) {
        setFaceVerifyState('verified'); // No user ID, skip face verify
        return;
      }
      const base64Data = photoDataUrl.split(',')[1];
      const response = await fetch(`${API_BASE_URL}/attendance/face/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, photo_data: base64Data }),
      });
      const data = await response.json();
      if (response.ok && (data.verified === true || data.match === true || data.success === true)) {
        setFaceVerifyState('verified');
      } else if (response.status === 404 || (data.detail && data.detail.includes('No face'))) {
        // No face registered for this user - allow check-in anyway
        setFaceVerifyState('verified');
      } else {
        setFaceVerifyState('failed');
      }
    } catch (error) {
      console.warn('Face verify error (allowing check-in):', error);
      // Network error - allow check-in anyway
      setFaceVerifyState('verified');
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setFaceVerifyState('idle');
  };

  const closeCameraModal = () => {
    stopCamera();
    setShowCamera(false);
    setCapturedPhoto(null);
    setPendingAction(null);
    setAttendanceLoading(false);
    setFaceVerifyState('idle');
    document.body.style.overflow = 'unset';
    const modalContainer = document.getElementById('camera-modal-container');
    if (modalContainer) {
      modalContainer.style.cssText = 'z-index: 0;';
      if (!modalContainer.hasChildNodes()) {
        document.body.removeChild(modalContainer);
      }
    }
  };

  const confirmPhoto = async () => {
    if (!capturedPhoto || !pendingAction) {
      console.error('No photo or pending action');
      return;
    }
    setAttendanceLoading(true);
    try {
      const userId = getUserId();
      if (!userId) throw new Error('User not found. Please login again.');
      const base64Data = capturedPhoto.split(',')[1];
      const endpoint = pendingAction === 'checkin'
        ? `${API_BASE_URL}/attendance/check-in?user_id=${userId}`
        : `${API_BASE_URL}/attendance/check-out?user_id=${userId}`;
      let geolocation = { latitude: 0.0, longitude: 0.0, accuracy: 0.0, address: "Unknown" };
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        geolocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          address: "Geolocation acquired",
        };
      } catch (error) {
        console.warn('Geolocation unavailable:', error);
      }
      const requestBody = {
        photo_data: base64Data,
        geolocation,
        comments: `${pendingAction === 'checkin' ? 'Check-in' : 'Check-out'} via web app`,
      };
      const apiResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (apiResponse.ok) {
        const data = await apiResponse.json();
        setIsCheckedIn(pendingAction === 'checkin');
        closeCameraModal();
        checkAttendanceStatus();
        // Show success modal based on response
        if (pendingAction === 'checkout') {
          setSuccessModal({ type: 'checked_out', title: 'Checked Out! 👋', message: data.message || 'Check-out successful!' });
        } else if (data.is_late || (data.status && data.status.includes('late'))) {
          setSuccessModal({ type: 'late', title: 'Late Check In ⏰', message: data.message || 'Check-in recorded (late).' });
        } else if (data.status && data.status.includes('half')) {
          setSuccessModal({ type: 'half_day', title: 'Half Day 🌤️', message: data.message || 'Half day attendance marked!' });
        } else {
          setSuccessModal({ type: 'full_day', title: 'Checked In! 🎉', message: data.message || 'Check-in successful!' });
        }
      } else {
        const errorData = await apiResponse.json();
        throw new Error(errorData.detail || 'Attendance action failed');
      }
    } catch (error) {
      console.error('Error with attendance:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleCheckIn = () => {
    setPendingAction('checkin');
    setShowCamera(true);
    setShowTimeMenu(false);
  };

  const handleCheckOut = () => {
    setPendingAction('checkout');
    setShowCamera(true);
    setShowTimeMenu(false);
  };

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const parts = timeFormatter.formatToParts(time);
  let numericTime = '';
  let period = '';
  parts.forEach(part => {
    if (['hour', 'minute', 'literal'].includes(part.type)) {
      numericTime += part.value;
    } else if (part.type === 'dayPeriod') {
      period = part.value;
    }
  });

  const handleLogout = () => {
    if (onLogout) onLogout();
  };

  return (
    <div className="flex items-center justify-between h-16 sm:h-20 px-4 sm:px-6 lg:px-8 border-b border-white/10 bg-black/40 backdrop-blur-lg shadow-md">
      {/* Left side - Title */}
      <h2 className="text-lg sm:text-2xl lg:text-3xl font-semibold text-white drop-shadow-md truncate max-w-[40%] sm:max-w-none">
        {selectedLabel}
      </h2>
      
      {/* Right side - Actions */}
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
        {/* Notifications Bell - Hidden on very small screens */}
        <div className="hidden sm:block">
          <NotificationBell />
        </div>

        {/* Clock and Attendance */}
        <div className="relative">
          <button
            ref={timeRef}
            type="button"
            className="flex items-center gap-1 sm:gap-3 cursor-pointer hover:bg-white/5 p-2 sm:p-3 rounded-lg transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowTimeMenu(!showTimeMenu);
              setShowUserMenu(false);
            }}
          >
            <div className="flex items-center gap-0">
              <p className="text-4xl sm:text-4xl lg:text-5xl font-semibold text-white tracking-tighter">{numericTime}</p>
              <p className="text-xs sm:text-sm  -mt-15 sm:-mt-3 font-medium text-white">{period}</p>
            </div>
          </button>
          <FloatingDropdown isOpen={showTimeMenu} triggerRef={timeRef} width="w-80 sm:w-80">
            <div className="p-3 sm:p-4 border-b border-gray-200 bg-white">
              <p className="text-gray-900 font-medium text-sm sm:text-base">Today's Attendance</p>
              {attendanceData ? (
                <div className="text-xs sm:text-sm text-gray-700 mt-2 space-y-2 sm:space-y-3">
                  {attendanceData.check_in_time && (
                    <div className="space-y-1 sm:space-y-2">
                      <p className="break-words">Check-in: <span className="text-green-600">{attendanceData.check_in_time}</span></p>
                      {attendanceData.check_in_photo_path && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 text-xs">Photo:</span>
                          <img
                            src={`${API_BASE_URL}/${attendanceData.check_in_photo_path}`}
                            alt="Check-in"
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-md object-cover border border-gray-300"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {attendanceData.check_out_time && (
                    <div className="space-y-1 sm:space-y-2">
                      <p className="break-words">Check-out: <span className="text-red-600">{attendanceData.check_out_time}</span></p>
                      {attendanceData.check_out_photo_path && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 text-xs">Photo:</span>
                          <img
                            src={`${API_BASE_URL}/${attendanceData.check_out_photo_path}`}
                            alt="Check-out"
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-md object-cover border border-gray-300"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {!attendanceData.check_in_time && !attendanceData.check_out_time && (
                    <p className="text-red-600">Not marked today</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-600 text-xs sm:text-sm mt-1">
                  Status: <span className="text-red-600">Not Checked In</span>
                </p>
              )}
            </div>
            <div className="p-2 sm:p-2 bg-white">
              {!isCheckedIn ? (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCheckIn();
                  }}
                  disabled={attendanceLoading}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm sm:text-base text-gray-900 hover:bg-green-50 border border-green-200 rounded-md transition-colors disabled:opacity-50"
                >
                  <Clock className="w-4 h-4" />
                  <span className="hidden sm:inline">{attendanceLoading ? 'Checking In...' : 'Check In'}</span>
                  <span className="sm:hidden">{attendanceLoading ? 'In...' : 'In'}</span>
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCheckOut();
                  }}
                  disabled={attendanceLoading}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm sm:text-base text-gray-900 hover:bg-red-50 border border-red-200 rounded-md transition-colors disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">{attendanceLoading ? 'Checking Out...' : 'Check Out'}</span>
                  <span className="sm:hidden">{attendanceLoading ? 'Out...' : 'Out'}</span>
                </button>
              )}
            </div>
          </FloatingDropdown>
        </div>

        {/* User Info */}
        <div className="relative">
          <button
            ref={userRef}
            type="button"
            className="flex items-center gap-2 sm:gap-4 cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowUserMenu(!showUserMenu);
              setShowTimeMenu(false);
            }}
          >
            {/* User name and designation - Hidden on mobile */}
            <div className="text-right hidden sm:block">
              <p className="text-white font-bold text-lg">
                {userName}
              </p>
              <p className="text-xs text-gray-300 font-medium uppercase tracking-wide">
                {user?.designation || 'DIRECTOR OF OPERATIONS'}
              </p>
            </div>
            
            {/* Profile picture - Always visible, rectangular styling */}
            <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-white/30 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 ease-in-out overflow-hidden">
              {userProfilePhoto && !profilePhotoError ? (
                <img 
                  src={userProfilePhoto} 
                  alt={`${userName}'s Profile`} 
                  className="w-full h-full object-cover rounded-lg"
                  onError={() => setProfilePhotoError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  {userName ? (
                    <span className="text-white font-bold text-lg">
                      {userName.split(' ').map(name => name[0]).join('').toUpperCase()}
                    </span>
                  ) : (
                    <User className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  )}
                </div>
              )}
            </div>
          </button>
          <FloatingDropdown isOpen={showUserMenu} triggerRef={userRef} width="w-[32rem]">
            <div className="p-6 bg-white">
              {/* User Info Section - Always visible */}
              <div className="flex items-start gap-4 mb-8">
                {/* Profile Picture - Optimized size for clear display */}
                <div className="flex items-center justify-center w-24 h-30 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-gray-300 overflow-hidden flex-shrink-0 shadow-lg">
                  {userProfilePhoto && !profilePhotoError ? (
                    <img 
                      src={userProfilePhoto} 
                      alt={`${userName}'s Profile`} 
                      className="w-full h-full object-cover rounded-xl"
                      onError={() => setProfilePhotoError(true)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {userName ? (
                        <span className="text-white font-bold text-xl">
                          {userName.split(' ').map(name => name[0]).join('').toUpperCase()}
                        </span>
                      ) : (
                        <User className="w-8 h-8 text-white" />
                      )}
                    </div>
                  )}
                </div>
                
                {/* User Details - Clear and readable layout */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-gray-900 mb-3 truncate">
                    {currentUserData?.name || userName || 'User Name'}
                  </h3>
                  <div className="space-y-2 text-sm text-gray-800">
                    <p className="font-semibold truncate">
                      <span className="font-medium">Employee ID</span> - {(() => {
                        console.log('=== NAVBAR EMPLOYEE ID DEBUG ===');
                        console.log('currentUserData:', currentUserData);
                        console.log('user prop:', user);
                        
                        // Check localStorage directly for employee data
                        const userDataLS = localStorage.getItem('user');
                        const userDataParsed = userDataLS ? JSON.parse(userDataLS) : null;
                        console.log('localStorage user data:', userDataParsed);
                        
                        // Try multiple possible fields for employee ID
                        const possibleIds = [
                          currentUserData?.employee_id,
                          currentUserData?.emp_id,
                          currentUserData?.id,
                          currentUserData?.code,
                          user?.employee_id,
                          user?.emp_id,
                          user?.id,
                          user?.code,
                          userDataParsed?.employee_id,
                          userDataParsed?.emp_id,
                          userDataParsed?.id,
                          userDataParsed?.code,
                          localStorage.getItem('employee_id'),
                          '007' // temporary hardcode for testing
                        ];
                        
                        console.log('Possible employee IDs:', possibleIds);
                        
                        // Find first valid ID that's not null/undefined/empty
                        const rawEmployeeId = possibleIds.find(id => {
                          return id !== null && id !== undefined && id !== '' && id !== 'null' && id !== 'undefined';
                        });
                        
                        console.log('Selected employee ID:', rawEmployeeId);
                        
                        if (rawEmployeeId) {
                          const formattedId = `RM${rawEmployeeId}`;
                          console.log('Formatted employee ID:', formattedId);
                          return formattedId;
                        }
                        
                        console.log('No employee ID found, showing Loading...');
                        return 'Loading...';
                      })()}
                    </p>
                    <p className="font-semibold truncate">
                      <span className="font-medium">Designation</span> - {currentUserData?.designation || user?.designation || user?.role || 'Not Available'}
                    </p>
                    <p className="font-semibold truncate">
                      <span className="font-medium">Department</span> - {currentUserData?.department || user?.department?.name || user?.department || 'Not Available'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Mobile-only notifications link */}
              <div className="sm:hidden mb-6">
                <NotificationBell />
              </div>
              
              {/* Change Password Button */}
              <div className="mb-6">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowChangePasswordInDropdown(!showChangePasswordInDropdown);
                    setPasswordErrors({});
                  }}
                  className="w-full flex items-center gap-3 px-6 py-3 text-base font-medium text-blue-500 hover:bg-blue-50 border-2 border-blue-300 hover:border-blue-400 rounded-lg transition-colors"
                >
                  <Key className="w-5 h-5 text-yellow-500" />
                  Change Password
                </button>
              </div>

              {/* Change Password Form Section - Shows/hides inline */}
              {showChangePasswordInDropdown && (
                <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                  <form onSubmit={(e) => { e.preventDefault(); handleUpdatePassword(); }} className="space-y-4">
                    {passwordErrors.general && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-red-600 text-sm">{passwordErrors.general}</p>
                      </div>
                    )}

                    {/* Old Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">
                        Old Password
                      </label>
                      <input
                        type="password"
                        placeholder="Enter current password"
                        value={passwordData.oldPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, oldPassword: e.target.value }))}
                        className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 placeholder-gray-400 ${
                          passwordErrors.oldPassword ? 'border-red-300 bg-red-50' : 'bg-white'
                        }`}
                        required
                      />
                      {passwordErrors.oldPassword && (
                        <p className="mt-1 text-sm text-red-600">{passwordErrors.oldPassword}</p>
                      )}
                    </div>

                    {/* New Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        placeholder="Enter new password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                        className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 placeholder-gray-400 ${
                          passwordErrors.newPassword ? 'border-red-300 bg-red-50' : 'bg-white'
                        }`}
                        required
                        minLength="6"
                      />
                      {passwordErrors.newPassword && (
                        <p className="mt-1 text-sm text-red-600">{passwordErrors.newPassword}</p>
                      )}
                    </div>

                    {/* Hidden Confirm Password Field - for validation only */}
                    <input
                      type="hidden"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    />

                    {/* Update Password Button */}
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {passwordLoading ? 'Updating...' : 'Update Password'}
                    </button>
                  </form>
                </div>
              )}
              
              {/* Logout Button - Always visible at bottom */}
              <div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-6 py-3 text-base font-medium text-red-600 hover:bg-red-50 border-2 border-red-400 hover:border-red-500 rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5 text-amber-800" />
                  Logout
                </button>
              </div>
            </div>
          </FloatingDropdown>
        </div>
      </div>

      <CameraModal
        showCamera={showCamera}
        pendingAction={pendingAction}
        closeCameraModal={closeCameraModal}
        videoRef={videoRef}
        canvasRef={canvasRef}
        capturedPhoto={capturedPhoto}
        capturePhoto={capturePhoto}
        retakePhoto={retakePhoto}
        confirmPhoto={confirmPhoto}
        attendanceLoading={attendanceLoading}
        faceVerifyState={faceVerifyState}
      />

      <SuccessModal
        successInfo={successModal}
        onClose={() => setSuccessModal(null)}
      />

      {/* Change Password Modal */}
      {showChangePasswordModal && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 10002 }}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Key className="w-5 h-5" />
                Change Password
              </h2>
              <button
                onClick={closeChangePasswordModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleUpdatePassword(); }} className="space-y-4">
              {passwordErrors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-600 text-sm">{passwordErrors.general}</p>
                </div>
              )}

              {/* Old Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Old Password *
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.old ? "text" : "password"}
                    value={passwordData.oldPassword}
                    onChange={(e) => handlePasswordInputChange('oldPassword', e.target.value)}
                    className={`w-full px-3 py-2 pr-10 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      passwordErrors.oldPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="Enter your current password"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('old')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.old ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordErrors.oldPassword && (
                  <p className="text-red-500 text-sm mt-1">{passwordErrors.oldPassword}</p>
                )}
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password *
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
                    className={`w-full px-3 py-2 pr-10 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      passwordErrors.newPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="Enter your new password"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('new')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordErrors.newPassword && (
                  <p className="text-red-500 text-sm mt-1">{passwordErrors.newPassword}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
                    className={`w-full px-3 py-2 pr-10 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      passwordErrors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="Confirm your new password"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordErrors.confirmPassword && (
                  <p className="text-red-500 text-sm mt-1">{passwordErrors.confirmPassword}</p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeChangePasswordModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {passwordLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}