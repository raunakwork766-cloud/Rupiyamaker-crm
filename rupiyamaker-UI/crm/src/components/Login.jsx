import React, { useState } from 'react';
import './Login.css';
import { updateProfilePhotoInStorage } from '../utils/profilePhotoUtils';

const Login = ({ onLogin }) => {
    const [formData, setFormData] = useState({
        identifier: '', // Can be username or email
        password: '',
        otpCode: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [otpRequired, setOtpRequired] = useState(false);
    const [otpGenerated, setOtpGenerated] = useState(false);
    const [userId, setUserId] = useState(null);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        // Clear error when user starts typing
        if (error) setError('');
    };

    const generateOTP = async () => {
        if (!userId) {
            setError('User ID not found. Please try logging in again.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch(`/api/otp/generate?user_id=${encodeURIComponent(userId)}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: userId
                })
            });

            const data = await response.json();

            if (response.ok) {
                setOtpGenerated(true);
                setError('');
                alert('OTP has been sent to administrators. Please check your email and enter the OTP below.');
            } else {
                // Handle OTP generation errors
                let errorMessage = 'Failed to generate OTP';
                if (data.detail) {
                    if (typeof data.detail === 'string') {
                        errorMessage = data.detail;
                    } else if (Array.isArray(data.detail)) {
                        errorMessage = data.detail.map(err => err.msg || 'Validation error').join(', ');
                    } else if (typeof data.detail === 'object') {
                        errorMessage = data.detail.message || JSON.stringify(data.detail);
                    }
                }
                setError(errorMessage);
            }
        } catch (error) {
            console.error('OTP generation error:', error);
            setError('Failed to generate OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.identifier || !formData.password) {
            setError('Please fill in all fields');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username_or_email: formData.identifier,
                    password: formData.password,
                    otp_code: otpRequired ? formData.otpCode : undefined
                })
            });

            // Handle 431 error - Request Header Fields Too Large
            if (response.status === 431) {
                console.log('⚠️ 431 Error detected - Too many cookies. Clearing all cookies...');
                
                // Clear all cookies
                document.cookie.split(";").forEach(c => {
                    const name = c.split("=")[0].trim();
                    if (name) {
                        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
                        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
                    }
                });
                
                // Clear storage
                localStorage.clear();
                sessionStorage.clear();
                
                setError('Too many cookies detected. Cookies cleared. Please try again.');
                setLoading(false);
                
                // Show alert and reload
                alert('Cookies cleared! Please click Login button again.');
                return;
            }

            const data = await response.json();

            if (response.ok) {
                // Store user data in localStorage similar to HTML version
                localStorage.setItem('userId', data.user._id || data.user.id);
                localStorage.setItem('user_id', data.user._id || data.user.id); // Also store as user_id for compatibility
                localStorage.setItem('userName', `${data.user.first_name} ${data.user.last_name}`);
                localStorage.setItem('userUsername', data.user.username);
                localStorage.setItem('userEmail', data.user.email);
                localStorage.setItem('userRole', data.role?.name || 'user');
                localStorage.setItem('department_id', data.user?.department_id || 'default_department_id');
                localStorage.setItem('department_name', data.department?.name || 'General');
                localStorage.setItem('designation_name', data.designation?.name || 'Employee');
                localStorage.setItem('token', data.token || 'authenticated'); // Store token separately
                localStorage.setItem('userProfilePhoto', data.user.profile_photo || ''); // Store profile photo
                localStorage.setItem('profile_photo', data.user.profile_photo || ''); // Store for navbar compatibility
                
                // Store employee_id if available in response
                if (data.user.employee_id) {
                  localStorage.setItem('employee_id', data.user.employee_id);
                  console.log('✅ Stored employee_id:', data.user.employee_id);
                }
                
                // Also store full user object for comprehensive access
                localStorage.setItem('user', JSON.stringify({
                  _id: data.user._id || data.user.id,
                  id: data.user._id || data.user.id,
                  employee_id: data.user.employee_id,
                  first_name: data.user.first_name,
                  last_name: data.user.last_name,
                  name: `${data.user.first_name} ${data.user.last_name}`,
                  username: data.user.username,
                  email: data.user.email,
                  profile_photo: data.user.profile_photo,
                  department_id: data.user.department_id,
                  department: data.department?.name || 'General',
                  designation: data.designation?.name || 'Employee',
                  role: data.role?.name || 'user'
                }));
                console.log('✅ Stored full user object in localStorage');
                console.log('📋 Login response data.user:', data.user);
                
                // Use utility function to update profile photo and trigger navbar refresh
                if (data.user.profile_photo) {
                  updateProfilePhotoInStorage(data.user.profile_photo);
                }

                // Format permissions from backend format to frontend format
                let permissions = {};

                // Check for super admin - look for Global: "*" or page: "*"
                const isSuperAdmin = data.permissions && Array.isArray(data.permissions) &&
                    data.permissions.some(p => 
                        (p.page === "*" && (p.actions === "*" || (Array.isArray(p.actions) && p.actions.includes("*")))) ||
                        (p.page === "Global" && (p.actions === "*" || (Array.isArray(p.actions) && p.actions.includes("*"))))
                    );

                if (isSuperAdmin) {
                    // Super admin format - store both old and new formats for compatibility
                    permissions = {
                        pages: "*",
                        actions: "*",
                        Global: "*",
                        global: "*",
                        // Also store all individual module permissions for compatibility
                        Settings: "*",
                        settings: "*",
                        Feeds: "*",
                        feeds: "*",
                        Leads: "*",
                        leads: "*",
                        Tasks: "*",
                        tasks: "*",
                        Tickets: "*",
                        tickets: "*",
                        "HRMS Employees": "*",
                        "hrms_employees": "*",
                        Leaves: "*",
                        leaves: "*",
                        Attendance: "*",
                        attendance: "*",
                        Warnings: "*",
                        warnings: "*",
                        Charts: "*",
                        charts: "*",
                        "EMI Calculator": "*",
                        "emi_calculator": "*",
                        Login: "*",
                        login: "*"
                    };
                    
                    // Also process the actual permissions array to ensure we have everything
                    if (data.permissions && Array.isArray(data.permissions)) {
                        data.permissions.forEach(perm => {
                            if (perm.page && perm.actions === "*") {
                                permissions[perm.page] = "*";
                            }
                        });
                    }
                } else if (data.permissions && Array.isArray(data.permissions)) {
                    // Process specific permissions from the array format to object format
                    data.permissions.forEach(perm => {
                        if (perm.page && perm.actions) {
                            // Store permissions using the exact page name from backend
                            if (!permissions[perm.page]) {
                                permissions[perm.page] = {};
                            }

                            // Handle wildcard actions for a page
                            if (perm.actions === "*" || (Array.isArray(perm.actions) && perm.actions.includes("*"))) {
                                permissions[perm.page] = "*";
                            }
                            // Handle array of actions
                            else if (Array.isArray(perm.actions)) {
                                // Check if array contains wildcard
                                if (perm.actions.includes("*")) {
                                    permissions[perm.page] = "*";
                                } else {
                                    perm.actions.forEach(action => {
                                        if (typeof permissions[perm.page] !== 'object') {
                                            permissions[perm.page] = {};
                                        }
                                        permissions[perm.page][action] = true;
                                    });
                                }
                            }
                            // Handle single action as string
                            else if (typeof perm.actions === 'string') {
                                if (typeof permissions[perm.page] !== 'object') {
                                    permissions[perm.page] = {};
                                }
                                permissions[perm.page][perm.actions] = true;
                            }
                        }
                    });
                }

                // Set default view permissions for essential sections if not set
                if (!permissions.feeds) {
                    permissions.feeds = { view: true };
                }

                // Store permissions in localStorage
                localStorage.setItem('userPermissions', JSON.stringify(permissions));
                console.log('Stored permissions:', permissions);

                // Also store for React compatibility
                const userData = {
                    id: data.user._id || data.user.id, // Add id field for consistency
                    _id: data.user._id || data.user.id,
                    user_id: data.user._id || data.user.id,
                    first_name: data.user.first_name,
                    last_name: data.user.last_name,
                    name: data.user.name || (data.user.first_name && data.user.last_name ? `${data.user.first_name} ${data.user.last_name}`.trim() : data.user.first_name || data.user.last_name || ''),
                    employee_id: data.user.employee_id || data.user.emp_id || data.user.code,
                    email: data.user.email,
                    username: data.user.username,
                    profile_photo: data.user.profile_photo, // Add profile photo
                    role: data.role,
                    department: data.department,
                    designation: data.designation,
                    department_id: data.department?._id || data.department?.id || data.user?.department_id || 'default_department_id',
                    designation_id: data.designation?._id || data.designation?.id || data.user?.designation_id,
                    permissions: permissions, // Store the formatted permissions here too
                    token: data.token || 'authenticated'
                };
                localStorage.setItem('userData', JSON.stringify(userData));
                localStorage.setItem('user', JSON.stringify(userData)); // Also store as 'user' for navbar compatibility
                localStorage.setItem('isAuthenticated', 'true');
                
                // Store employee_id separately for easy access
                if (userData.employee_id) {
                    localStorage.setItem('employee_id', userData.employee_id);
                }
                
                // Store userName for easy access
                if (userData.name) {
                    localStorage.setItem('userName', userData.name);
                }

                // Call the onLogin callback to update parent component
                onLogin(userData);
            } else if (response.status === 428) {
                // OTP required
                setOtpRequired(true);
                
                // Handle different response formats
                let userIdToSet = null;
                if (typeof data.detail === 'object' && data.detail.user_id) {
                    // New format with user_id in detail object
                    userIdToSet = data.detail.user_id;
                } else {
                    // Fallback for other formats
                    userIdToSet = data.user_id || data.userId || data.user?._id || data.user?.id;
                }
                
                setUserId(userIdToSet);
                
                // Set error message - handle different response formats
                let errorMessage = 'OTP verification required. Please generate an OTP to continue.';
                if (typeof data.detail === 'object') {
                    if (data.detail.message) {
                        // Our custom format with message
                        errorMessage = data.detail.message;
                    } else if (Array.isArray(data.detail)) {
                        // Validation error array format
                        errorMessage = data.detail.map(err => err.msg || 'Validation error').join(', ');
                    } else {
                        // Other object format
                        errorMessage = JSON.stringify(data.detail);
                    }
                } else if (typeof data.detail === 'string') {
                    errorMessage = data.detail;
                }
                setError(errorMessage);
            } else {
                // Handle other error responses
                let errorMessage = 'Login failed. Please check your credentials.';
                if (data.detail) {
                    if (typeof data.detail === 'string') {
                        errorMessage = data.detail;
                    } else if (Array.isArray(data.detail)) {
                        errorMessage = data.detail.map(err => err.msg || 'Validation error').join(', ');
                    } else if (typeof data.detail === 'object') {
                        errorMessage = data.detail.message || JSON.stringify(data.detail);
                    }
                }
                setError(errorMessage);
            }
        } catch (error) {
            console.error('Login error:', error);
            setError('Connection error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            {/* Animated Background */}
            <div className="login-background">
                <div className="floating-particles">
                    {[...Array(20)].map((_, i) => (
                        <div key={i} className={`particle particle-${i}`}></div>
                    ))}
                </div>
            </div>

            {/* Login Card */}
            <div className="login-card">
                <div className="login-header">
                    <div className="logo-container">
                        <div className="logo-icon">₹</div>
                        <h1 className="logo-text">RupiyaMaker</h1>
                    </div>
                    <p className="login-subtitle">Welcome back! Please sign in to continue.</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    {error && (
                        <div className="error-message">
                            <i className="error-icon">⚠️</i>
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <div className="input-container">
                            <i className="input-icon">👤</i>
                            <input
                                type="text"
                                name="identifier"
                                placeholder="Username or Email"
                                value={formData.identifier}
                                onChange={handleChange}
                                className="form-input"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <div className="input-container">
                            <i className="input-icon">🔒</i>
                            <input
                                type="password"
                                name="password"
                                placeholder="Password"
                                value={formData.password}
                                onChange={handleChange}
                                className="form-input"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {otpRequired && (
                        <div className="otp-section">
                            <div className="otp-info">
                                <p>🔐 OTP verification required for your account</p>
                                <p className="otp-subtitle">Generate an OTP to continue with login</p>
                            </div>
                            
                            {!otpGenerated ? (
                                <button
                                    type="button"
                                    onClick={generateOTP}
                                    className="otp-generate-button"
                                    disabled={loading}
                                >
                                    {loading ? 'Generating...' : 'Generate OTP'}
                                </button>
                            ) : (
                                <div className="form-group">
                                    <div className="input-container">
                                        <i className="input-icon">🔑</i>
                                        <input
                                            type="text"
                                            name="otpCode"
                                            placeholder="Enter OTP Code"
                                            value={formData.otpCode}
                                            onChange={handleChange}
                                            className="form-input"
                                            disabled={loading}
                                            maxLength="6"
                                        />
                                    </div>
                                    <p className="otp-help">Enter the 6-digit OTP sent to administrators</p>
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        type="submit"
                        className={`login-button ${loading ? 'loading' : ''}`}
                        disabled={loading || (otpRequired && !otpGenerated)}
                    >
                        {loading ? (
                            <>
                                <div className="spinner"></div>
                                {otpRequired ? 'Verifying OTP...' : 'Signing in...'}
                            </>
                        ) : otpRequired && !otpGenerated ? (
                            'Generate OTP First'
                        ) : otpRequired ? (
                            'Verify OTP & Sign In'
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>

                <div className="login-footer">
                    <p>© 2025 RupiyaMaker. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
