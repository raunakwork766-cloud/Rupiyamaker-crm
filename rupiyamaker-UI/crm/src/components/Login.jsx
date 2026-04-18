import React, { useState, useEffect } from 'react';
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
    const [logoutBanner, setLogoutBanner] = useState('');
    const [otpRequired, setOtpRequired] = useState(false);
    const [otpGenerated, setOtpGenerated] = useState(false);
    const [userId, setUserId] = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    // 🔔 Show displaced-session / forced-logout message from sessionStorage
    useEffect(() => {
        const reason = sessionStorage.getItem('logoutReason');
        if (reason) {
            setLogoutBanner(reason);
            sessionStorage.removeItem('logoutReason');
        }
    }, []);

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

        // Read directly from DOM for Chrome autofill compatibility
        const form = e.target;
        const identifierInput = form.querySelector('input[name="identifier"]');
        const passwordInput = form.querySelector('input[name="password"]');
        const identifier = formData.identifier || identifierInput?.value || '';
        const password = formData.password || passwordInput?.value || '';

        if (!identifier || !password) {
            setError('Please enter your username and password.');
            return;
        }

        // Ensure showPassword is off when submitting
        setShowPassword(false);
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username_or_email: identifier,
                    password: password,
                    otp_code: otpRequired ? formData.otpCode : undefined
                })
            });

            // Handle 431 error - Request Header Fields Too Large
            if (response.status === 431) {
                console.log('⚠️ 431 Error detected - Too many cookies. Clearing all cookies...');
                
                // Clear all cookies aggressively
                document.cookie.split(";").forEach(c => {
                    const name = c.split("=")[0].trim();
                    if (name) {
                        // Clear for all possible combinations
                        const domains = ['', window.location.hostname, '.' + window.location.hostname];
                        const paths = ['/', '/api', '/api/'];
                        
                        domains.forEach(domain => {
                            paths.forEach(path => {
                                document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=' + path + (domain ? '; domain=' + domain : '');
                            });
                        });
                    }
                });
                
                // Clear storage
                localStorage.clear();
                sessionStorage.clear();
                
                console.log('✅ All cookies cleared. Reloading page...');
                
                // Reload page to clear headers from memory
                setTimeout(() => {
                    window.location.reload();
                }, 500);
                
                return;
            }

            const data = await response.json();

            if (response.ok) {
                // 🔒 Clear old localStorage before storing new login data to prevent quota exceeded
                try {
                    localStorage.clear();
                } catch (e) {
                    // If clear fails too, try removing items one by one
                    try {
                        const keysToRemove = [];
                        for (let i = 0; i < localStorage.length; i++) {
                            keysToRemove.push(localStorage.key(i));
                        }
                        keysToRemove.forEach(k => localStorage.removeItem(k));
                    } catch (e2) {
                        console.error('Could not clear localStorage:', e2);
                    }
                }

                // Store essential user data in localStorage
                localStorage.setItem('userId', data.user._id || data.user.id);
                localStorage.setItem('user_id', data.user._id || data.user.id);
                localStorage.setItem('userName', `${data.user.first_name} ${data.user.last_name}`);
                localStorage.setItem('userUsername', data.user.username);
                localStorage.setItem('userEmail', data.user.email || '');
                localStorage.setItem('userRole', data.role?.name || 'user');
                localStorage.setItem('department_id', data.user?.department_id || 'default_department_id');
                localStorage.setItem('department_name', data.department?.name || 'General');
                localStorage.setItem('designation_name', data.designation?.name || 'Employee');
                localStorage.setItem('token', data.token || 'authenticated');
                if (data.session_token) {
                  localStorage.setItem('sessionToken', data.session_token);
                }
                localStorage.setItem('userProfilePhoto', data.user.profile_photo || '');
                localStorage.setItem('profile_photo', data.user.profile_photo || '');
                
                if (data.user.employee_id) {
                  localStorage.setItem('employee_id', data.user.employee_id);
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

                            // PARENT KEY PROPAGATION: If page uses dot-notation (e.g. "leads.create_lead"),
                            // also set the parent page key so route guards & sidebar can find it.
                            if (perm.page.includes('.')) {
                                const parentPage = perm.page.split('.')[0];
                                if (!permissions[parentPage]) {
                                    permissions[parentPage] = {};
                                }
                                if (typeof permissions[parentPage] === 'object') {
                                    const actions = Array.isArray(perm.actions) ? perm.actions : [perm.actions];
                                    if (actions.includes('show') || actions.includes('*') || actions.includes('all')) {
                                        permissions[parentPage]['show'] = true;
                                    }
                                }
                            }
                        }
                    });
                }

                // Set default show permission for feeds if not explicitly set by the role
                if (!permissions.feeds) {
                    permissions.feeds = { show: true, view: true };
                } else if (typeof permissions.feeds === 'object' && !permissions.feeds.show) {
                    // If feeds object exists but show is not explicitly set, grant show by default
                    permissions.feeds.show = true;
                }

                // Store permissions in localStorage
                localStorage.setItem('userPermissions', JSON.stringify(permissions));

                // Store compact user object (single source, no duplicates)
                const userData = {
                    id: data.user._id || data.user.id,
                    _id: data.user._id || data.user.id,
                    user_id: data.user._id || data.user.id,
                    first_name: data.user.first_name,
                    last_name: data.user.last_name,
                    name: data.user.name || (data.user.first_name && data.user.last_name ? `${data.user.first_name} ${data.user.last_name}`.trim() : data.user.first_name || data.user.last_name || ''),
                    employee_id: data.user.employee_id || data.user.emp_id || data.user.code,
                    email: data.user.email,
                    username: data.user.username,
                    profile_photo: data.user.profile_photo,
                    role: data.role ? { _id: data.role._id, name: data.role.name } : null,
                    department: data.department ? { _id: data.department._id, name: data.department.name } : null,
                    designation: data.designation,
                    department_id: data.department?._id || data.department?.id || data.user?.department_id || 'default_department_id',
                    designation_id: data.designation?._id || data.designation?.id || data.user?.designation_id,
                    token: data.token || 'authenticated',
                    is_super_admin: data.role?.name === 'Super Admin' || data.user?.role_id === '685292be8d7cdc3a71c4829b',
                    is_admin: data.role?.name === 'Super Admin' || data.role?.name === 'Admin' || data.user?.role_id === '685292be8d7cdc3a71c4829b'
                };
                const userDataStr = JSON.stringify(userData);
                localStorage.setItem('userData', userDataStr);
                localStorage.setItem('user', userDataStr);
                localStorage.setItem('isAuthenticated', 'true');
                
                if (userData.employee_id) {
                    localStorage.setItem('employee_id', userData.employee_id);
                }
                if (userData.name) {
                    localStorage.setItem('userName', userData.name);
                }
                
                // Update profile photo in storage for navbar
                if (data.user.profile_photo) {
                    updateProfilePhotoInStorage(data.user.profile_photo);
                }

                // Call the onLogin callback to update parent component
                setLogoutBanner(''); // Clear any displaced-session banner on success
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
                // Handle other error responses with precise, user-friendly messages
                let errorMessage = 'Login failed. Please try again.';
                if (data.detail) {
                    const detail = typeof data.detail === 'string' ? data.detail
                        : Array.isArray(data.detail) ? data.detail.map(err => err.msg || '').join(', ')
                        : data.detail.message || '';

                    // Precise error codes from backend
                    if (detail === 'USERNAME_NOT_FOUND') {
                        const enteredId = identifier.includes('@') ? 'email' : 'username';
                        errorMessage = `No account found with this ${enteredId}. Please check and try again.`;
                    } else if (detail === 'WRONG_PASSWORD') {
                        errorMessage = 'Incorrect password. Please check and try again.';
                    } else if (detail === 'ACCOUNT_INACTIVE') {
                        errorMessage = 'Your account is inactive. Please contact your administrator.';
                    } else if (detail === 'LOGIN_DISABLED') {
                        errorMessage = 'Login access is turned OFF for your account. Please contact your administrator.';
                    }
                    // Legacy messages (fallback for older backend versions)
                    else if (detail.toLowerCase().includes('invalid username') || detail.toLowerCase().includes('invalid password') || detail.toLowerCase().includes('invalid credentials')) {
                        errorMessage = 'Wrong username or password. Please check and try again.';
                    } else if (detail.toLowerCase().includes('inactive')) {
                        errorMessage = 'Your account is inactive. Please contact your administrator.';
                    } else if (detail.toLowerCase().includes('login access') || detail.toLowerCase().includes('disabled')) {
                        errorMessage = 'Login access is turned OFF for your account. Please contact your administrator.';
                    } else if (detail.toLowerCase().includes('session')) {
                        errorMessage = 'Your session has ended. Please login again.';
                    } else if (detail) {
                        errorMessage = detail;
                    }
                }
                setError(errorMessage);
            }
        } catch (error) {
            console.error('Login error:', error);
            // Simple, clear error messages for users
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                setError('Server is not responding. Please wait a moment and try again.');
            } else if (error.name === 'SyntaxError') {
                setError('Server error. Please try again in a moment.');
            } else if (error.message?.includes('quota') || error.message?.includes('storage') || error.message?.includes('setItem')) {
                // localStorage quota exceeded — clear and retry
                try {
                    localStorage.clear();
                    sessionStorage.clear();
                } catch (e) { /* ignore */ }
                setError('Browser storage was full. It has been cleared — please click Sign In again.');
            } else {
                setError('Something went wrong. Please try again.');
            }
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
                    {logoutBanner && (
                        <div className="error-message" style={{ background: 'linear-gradient(135deg, #ff6b35, #f7931e)', border: '1px solid #ff6b35', marginBottom: '12px' }}>
                            <i className="error-icon">🔔</i>
                            {logoutBanner}
                        </div>
                    )}
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
                                autoComplete="username"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <div className="input-container">
                            <i className="input-icon">🔒</i>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                placeholder="Password"
                                value={formData.password}
                                onChange={handleChange}
                                className="form-input"
                                style={{ paddingRight: '48px' }}
                                autoComplete="current-password"
                                disabled={loading}
                            />
                            <button
                                type="button"
                                className="password-toggle-btn"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                tabIndex={-1}
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                        <line x1="1" y1="1" x2="23" y2="23"/>
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                        <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                )}
                            </button>
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
