                                                                                                                                    import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Login.css';
import { updateProfilePhotoInStorage } from '../utils/profilePhotoUtils';
import {
    ATTENDANCE_LOGIN_PATH,                                                                                                                                  
    CRM_LOGIN_PATH,
    resolveLoginMode,
    clearLegacyAttendanceLoginFlags,
} from '../utils/loginMode';
import { persistAttendanceSession, scrubAttendanceFromLocalStorage } from '../utils/authSession';
import fyfLogoForm from '../assets/fix-your-finance-logo-form-light.png';

const FYF_BRAND_LOGO = '/fix-your-finance-logo-brand.png';
const LOGIN_HERO_PANEL = '/login-hero-panel.png';

const Login = ({ onLogin, forcedMode = null }) => {
    // onLogin(user, scope) — scope is 'crm' | 'attendance'
    const location = useLocation();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        identifier: '',
        password: '',
        otpCode: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [logoutBanner, setLogoutBanner] = useState('');
    const [otpRequired, setOtpRequired] = useState(false);
    const [otpGenerated, setOtpGenerated] = useState(false);
    const [otpChecking, setOtpChecking] = useState(false);
    const [userId, setUserId] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [fyfLogoBroken, setFyfLogoBroken] = useState(false);
    const [heroBrandBroken, setHeroBrandBroken] = useState(false);
    const loginMode = useMemo(
        () => resolveLoginMode({
            pathname: location.pathname,
            search: location.search,
            forcedMode,
        }),
        [location.pathname, location.search, forcedMode]
    );
    const isAttendanceMode = loginMode === 'attendance';

    // Legacy ?mode=attendance on /login → dedicated attendance URL
    useEffect(() => {
        if (
            location.pathname === CRM_LOGIN_PATH &&
            new URLSearchParams(location.search).get('mode') === 'attendance'
        ) {
            navigate(ATTENDANCE_LOGIN_PATH, { replace: true });
        }
    }, [location.pathname, location.search, navigate]);

    // CRM login must never inherit a stale attendance flag from sessionStorage
    useEffect(() => {
        clearLegacyAttendanceLoginFlags();
        if (!isAttendanceMode) {
            setOtpRequired(false);
            setOtpGenerated(false);
            setUserId(null);
        }
    }, [isAttendanceMode]);

    useEffect(() => {
        const reason = sessionStorage.getItem('logoutReason');
        if (reason) {
            setLogoutBanner(reason);
            sessionStorage.removeItem('logoutReason');
        }
    }, []);

    // Debounced pre-login check: as soon as the user finishes typing their
    // username/email, ask the backend whether this account logs in via OTP.
    // If so, we hide the password field and surface the OTP flow directly —
    // OTP users never need to enter a password.
    useEffect(() => {
        // Attendance login always uses a password — never auto-switch to OTP here.
        if (isAttendanceMode) return;

        const identifier = (formData.identifier || '').trim();
        if (!identifier) {
            setOtpRequired(false);
            setOtpGenerated(false);
            setUserId(null);
            return;
        }

        let cancelled = false;
        setOtpChecking(true);
        const timer = setTimeout(async () => {
            try {
                const resp = await fetch(`/api/users/login/otp-status?identifier=${encodeURIComponent(identifier)}`);
                if (!resp.ok) return;
                const data = await resp.json();
                if (cancelled) return;
                if (data?.otp_required) {
                    setOtpRequired(true);
                    if (data.user_id) setUserId(data.user_id);
                } else {
                    setOtpRequired(false);
                    setOtpGenerated(false);
                    setUserId(null);
                }
            } catch (_) {
                // Network hiccup — fall back to normal password login (server
                // still enforces OTP at submit time via the 428 response).
            } finally {
                if (!cancelled) setOtpChecking(false);
            }
        }, 450);

        return () => {
            cancelled = true;
            clearTimeout(timer);
            setOtpChecking(false);
        };
    }, [formData.identifier, isAttendanceMode]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            const data = await response.json();
            if (response.ok) {
                setOtpGenerated(true);
                setError('');
            } else {
                let errorMessage = 'Failed to generate OTP. Please try again.';
                const detail = data?.detail;
                const code = (detail && typeof detail === 'object' && detail.code) || null;
                if (code === 'OTP_ROUTING_NOT_CONFIGURED' || code === 'APPROVER_PERSONAL_EMAIL_MISSING' || code === 'SMTP_NOT_CONFIGURED') {
                    errorMessage = 'OTP could not be sent. Please contact your administrator.';
                } else if (detail) {
                    if (typeof detail === 'string') errorMessage = detail;
                    else if (Array.isArray(detail)) errorMessage = detail.map(err => err.msg || '').join(', ');
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
        const form = e.target;
        const identifierInput = form.querySelector('input[name="identifier"]');
        const passwordInput = form.querySelector('input[name="password"]');
        const identifier = formData.identifier || identifierInput?.value || '';
        const password = formData.password || passwordInput?.value || '';

        // OTP-login users authenticate with the OTP code only — no password needed.
        if (otpRequired && !isAttendanceMode) {
            if (!identifier) {
                setError('Please enter your username or email.');
                return;
            }
            if (!otpGenerated) {
                setError('Please generate an OTP first.');
                return;
            }
            if (!formData.otpCode) {
                setError('Please enter the OTP sent to your approvers.');
                return;
            }
        } else if (!identifier || !password) {
            setError('Please enter your username and password.');
            return;
        }
        setShowPassword(false);
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username_or_email: identifier,
                    password: otpRequired && !isAttendanceMode ? undefined : password,
                    otp_code: otpRequired ? formData.otpCode : undefined,
                    login_type: isAttendanceMode ? 'attendance_only' : 'crm'
                })
            });

            if (response.status === 431) {
                document.cookie.split(";").forEach(c => {
                    const name = c.split("=")[0].trim();
                    if (name) {
                        const domains = ['', window.location.hostname, '.' + window.location.hostname];
                        const paths = ['/', '/api', '/api/'];
                        domains.forEach(domain => {
                            paths.forEach(path => {
                                document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=' + path + (domain ? '; domain=' + domain : '');
                            });
                        });
                    }
                });
                localStorage.clear();
                sessionStorage.clear();
                setTimeout(() => window.location.reload(), 500);
                return;
            }

            const data = await response.json();

            if (response.ok) {
                if (data.login_type === 'attendance_only') {
                    clearLegacyAttendanceLoginFlags();
                    scrubAttendanceFromLocalStorage();
                    const uid = data.user._id || data.user.id;
                    const minimalUser = {
                        _id: uid,
                        id: uid,
                        user_id: uid,
                        first_name: data.user.first_name,
                        last_name: data.user.last_name,
                        username: data.user.username,
                        email: data.user.email,
                        profile_photo: data.user.profile_photo,
                        employee_id: data.user.employee_id,
                    };
                    persistAttendanceSession({ user: minimalUser, sessionToken: data.session_token });
                    setLogoutBanner('');
                    onLogin(minimalUser, 'attendance');
                    return;
                }

                scrubAttendanceFromLocalStorage();
                localStorage.setItem('loginType', 'crm');
                const authKeysToReset = ['token', 'sessionToken', 'userId', 'user_id', 'userName', 'userUsername', 'userEmail', 'userRole', 'department_id', 'department_name', 'designation_name', 'userProfilePhoto', 'profile_photo', 'employee_id', 'userData', 'user', 'isAuthenticated', 'cached_permissions', 'cachedSidebarMenuData_v1', 'sidebarMenuData'];
                authKeysToReset.forEach((key) => localStorage.removeItem(key));

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
                if (data.session_token) localStorage.setItem('sessionToken', data.session_token);
                localStorage.setItem('userProfilePhoto', data.user.profile_photo || '');
                localStorage.setItem('profile_photo', data.user.profile_photo || '');
                if (data.user.employee_id) localStorage.setItem('employee_id', data.user.employee_id);

                let permissions = {};
                const isSuperAdmin = data.permissions && Array.isArray(data.permissions) &&
                    data.permissions.some(p =>
                        (p.page === "*" && (p.actions === "*" || (Array.isArray(p.actions) && p.actions.includes("*")))) ||
                        (p.page === "Global" && (p.actions === "*" || (Array.isArray(p.actions) && p.actions.includes("*"))))
                    );

                if (isSuperAdmin) {
                    permissions = { pages: "*", actions: "*", Global: "*", global: "*", Settings: "*", settings: "*", Feeds: "*", feeds: "*", Leads: "*", leads: "*", Tasks: "*", tasks: "*", Tickets: "*", tickets: "*", "HRMS Employees": "*", "hrms_employees": "*", Leaves: "*", leaves: "*", Attendance: "*", attendance: "*", Warnings: "*", warnings: "*", Charts: "*", charts: "*", "EMI Calculator": "*", "emi_calculator": "*", Login: "*", login: "*" };
                    if (data.permissions && Array.isArray(data.permissions)) {
                        data.permissions.forEach(perm => { if (perm.page && perm.actions === "*") permissions[perm.page] = "*"; });
                    }
                } else if (data.permissions && Array.isArray(data.permissions)) {
                    data.permissions.forEach(perm => {
                        if (perm.page && perm.actions) {
                            if (!permissions[perm.page]) permissions[perm.page] = {};
                            if (perm.actions === "*" || (Array.isArray(perm.actions) && perm.actions.includes("*"))) {
                                permissions[perm.page] = "*";
                            } else if (Array.isArray(perm.actions)) {
                                if (perm.actions.includes("*")) permissions[perm.page] = "*";
                                else perm.actions.forEach(action => { if (typeof permissions[perm.page] !== 'object') permissions[perm.page] = {}; permissions[perm.page][action] = true; });
                            } else if (typeof perm.actions === 'string') {
                                if (typeof permissions[perm.page] !== 'object') permissions[perm.page] = {};
                                permissions[perm.page][perm.actions] = true;
                            }
                        }
                    });
                }

                localStorage.setItem('userPermissions', JSON.stringify(permissions));

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
                if (userData.employee_id) localStorage.setItem('employee_id', userData.employee_id);
                if (userData.name) localStorage.setItem('userName', userData.name);
                if (data.user.profile_photo) updateProfilePhotoInStorage(data.user.profile_photo);

                setLogoutBanner('');
                onLogin(userData, 'crm');

            } else if (response.status === 428) {
                if (isAttendanceMode) {
                    setError('Attendance login failed. Please refresh the page and try again.');
                    setLoading(false);
                    return;
                }
                setOtpRequired(true);
                let userIdToSet = null;
                if (typeof data.detail === 'object' && data.detail.user_id) {
                    userIdToSet = data.detail.user_id;
                } else {
                    userIdToSet = data.user_id || data.userId || data.user?._id || data.user?.id;
                }
                setUserId(userIdToSet);
                setError('');
            } else {
                let errorMessage = 'Login failed. Please try again.';
                if (data.detail) {
                    const detail = typeof data.detail === 'string' ? data.detail
                        : Array.isArray(data.detail) ? data.detail.map(err => err.msg || '').join(', ')
                        : data.detail.message || '';
                    if (detail === 'USERNAME_NOT_FOUND') {
                        const enteredId = identifier.includes('@') ? 'email' : 'username';
                        errorMessage = `No account found with this ${enteredId}. Please check and try again.`;
                    } else if (detail === 'WRONG_PASSWORD') {
                        errorMessage = 'Incorrect password. Please check and try again.';
                    } else if (detail === 'ACCOUNT_INACTIVE') {
                        errorMessage = 'Your account is inactive. Please contact your administrator.';
                    } else if (detail === 'LOGIN_DISABLED') {
                        errorMessage = 'Login access is turned OFF for your account. Please contact your administrator.';
                    } else if (detail.toLowerCase().includes('invalid username') || detail.toLowerCase().includes('invalid password') || detail.toLowerCase().includes('invalid credentials')) {
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
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                setError('Server is not responding. Please wait a moment and try again.');
            } else if (error.name === 'SyntaxError') {
                setError('Server error. Please try again in a moment.');
            } else if (error.message?.includes('quota') || error.message?.includes('storage') || error.message?.includes('setItem')) {
                try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* ignore */ }
                setError('Browser storage was full. It has been cleared — please click Sign In again.');
            } else {
                setError('Something went wrong. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-shell">
                <aside className="login-hero" aria-label="Brand">
                    <div className="login-hero-rings" aria-hidden />
                    <div className="login-hero-inner">
                        {!heroBrandBroken ? (
                            <img
                                src={FYF_BRAND_LOGO}
                                alt="Fix Your Finance"
                                className="login-hero-brand-logo"
                                onError={() => setHeroBrandBroken(true)}
                            />
                        ) : (
                            <span className="login-hero-logo-fallback">Fix Your Finance</span>
                        )}
                        <h1 className="login-hero-heading">
                            Manage your<br />money
                        </h1>
                        <div className="login-hero-phone-wrap">
                            <img
                                src={LOGIN_HERO_PANEL}
                                alt=""
                                className="login-hero-phone-img"
                                decoding="async"
                            />
                        </div>
                    </div>
                    <div className="login-hero-a11y" aria-hidden="true" title="Accessibility">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" role="presentation">
                            <circle cx="12" cy="5" r="2.5" fill="currentColor" />
                            <path fill="currentColor" d="M8 10.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5V12h1.5v6H17v-5h-2v5h-2v-4h-2v4H9v-5H7v5H5.5v-6H7v-1.5z" />
                        </svg>
                    </div>
                </aside>

                <div className="login-side">
                    <div className="login-side-top">
                        {!fyfLogoBroken ? (
                            <img
                                src={fyfLogoForm}
                                alt="Fix Your Finance"
                                className="login-fyf-logo"
                                onError={() => setFyfLogoBroken(true)}
                            />
                        ) : (
                            <span className="login-fyf-logo-fallback">Fix Your Finance</span>
                        )}
                        {isAttendanceMode && (
                            <span className="login-attendance-pill">Attendance</span>
                        )}
                    </div>

                    <h2 className="login-form-title">Sign In</h2>
                    <p className="login-form-sub">
                        {isAttendanceMode
                            ? 'Sign in with your employee account to mark attendance.'
                            : 'Welcome back — enter your credentials to open the CRM.'}
                    </p>

                    <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
                        {logoutBanner && (
                            <div className="login-alert login-alert--warning">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                                {logoutBanner}
                            </div>
                        )}
                        {error && (
                            <div className="login-alert login-alert--error">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                {error}
                            </div>
                        )}

                        <div className="login-field">
                            <label className="login-label" htmlFor="identifier">Email or username</label>
                            <div className="login-input-wrap">
                                <input
                                    id="identifier"
                                    type="text"
                                    name="identifier"
                                    placeholder="Email or Username"
                                    value={formData.identifier}
                                    onChange={handleChange}
                                    className="login-input"
                                    autoComplete="username"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {!(otpRequired && !isAttendanceMode) && (
                        <div className="login-field">
                            <label className="login-label" htmlFor="password">Password</label>
                            <div className="login-input-wrap">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    placeholder="Password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="login-input login-input--password"
                                    autoComplete="current-password"
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    className="login-eye-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    tabIndex={-1}
                                >
                                    {showPassword ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    )}
                                </button>
                            </div>
                            {otpChecking && (
                                <p className="login-otp-hint" style={{ marginTop: 6 }}>Checking sign-in method…</p>
                            )}
                        </div>
                        )}

                        {otpRequired && !isAttendanceMode && (
                            <div className="login-otp-section">
                                {!otpGenerated ? (
                                    <button type="button" onClick={generateOTP} className="login-otp-btn" disabled={loading}>
                                        {loading ? 'Generating…' : 'Generate OTP'}
                                    </button>
                                ) : (
                                    <div className="login-field">
                                        <label className="login-label" htmlFor="otpCode">Enter OTP</label>
                                        <div className="login-input-wrap">
                                            <input
                                                id="otpCode"
                                                type="text"
                                                name="otpCode"
                                                placeholder="6-digit code"
                                                value={formData.otpCode}
                                                onChange={handleChange}
                                                className="login-input"
                                                disabled={loading}
                                                maxLength="6"
                                                autoFocus
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="login-submit-btn"
                            disabled={loading || (otpRequired && !otpGenerated)}
                        >
                            {loading ? (
                                <>
                                    <span className="login-spinner" />
                                    {otpRequired ? 'Verifying…' : 'Signing in…'}
                                </>
                            ) : otpRequired && !otpGenerated ? (
                                'Generate OTP first'
                            ) : otpRequired ? (
                                <>
                                    Verify & Sign In
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                </>
                            ) : (
                                <>
                                    Sign In
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                </>
                            )}
                        </button>

                        <p className="login-mode-switch" style={{ marginTop: 16, textAlign: 'center', fontSize: 13 }}>
                            {isAttendanceMode ? (
                                <>
                                    Need full CRM access?{' '}
                                    <button
                                        type="button"
                                        className="login-attendance-link"
                                        style={{ display: 'inline', padding: 0, background: 'none', border: 'none' }}
                                        onClick={() => navigate(CRM_LOGIN_PATH)}
                                    >
                                        Sign in with OTP →
                                    </button>
                                </>
                            ) : (
                                <>
                                    Marking attendance only?{' '}
                                    <button
                                        type="button"
                                        className="login-attendance-link"
                                        style={{ display: 'inline', padding: 0, background: 'none', border: 'none' }}
                                        onClick={() => navigate(ATTENDANCE_LOGIN_PATH)}
                                    >
                                        Attendance login (no OTP) →
                                    </button>
                                </>
                            )}
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
