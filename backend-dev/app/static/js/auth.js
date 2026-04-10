// Debug: Log that auth.js is loading
console.log("auth.js is loading...");

// Login handler
function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showAlert('Please enter both username and password', 'danger');
        return;
    }

    fetch('/users/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username_or_email: username,
            password: password
        })
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.detail || 'Invalid credentials');
                });
            }
            return response.json();
        })
        .then(data => {
            // Store user data in localStorage
            localStorage.setItem('userId', data.user.id);
            localStorage.setItem('userName', `${data.user.first_name} ${data.user.last_name}`);
            localStorage.setItem('userUsername', data.user.username);
            localStorage.setItem('userPermissions', JSON.stringify(data.permissions));

            // Store auth token
            localStorage.setItem('token', data.access_token);

            // Redirect to appropriate page
            if (data.permissions && data.permissions.feeds) {
                window.location.href = '/products-page';
            } else {
                window.location.href = '/';
            }
        })
        .catch(error => {
            showAlert(error.message, 'danger');
        });
}

// Show alert message
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alertContainer');

    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    alertContainer.innerHTML = '';
    alertContainer.appendChild(alert);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
        if (alert) {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }
    }, 5000);
}

// Logout function
function logout() {
    // Clear localStorage
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userUsername');
    localStorage.removeItem('userPermissions');
    localStorage.removeItem('token');

    // Redirect to login page
    window.location.href = '/';
}

// Check if user is authenticated
function checkAuthentication() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');

    if (!userId || !token) {
        console.log("Authentication check failed: Missing userId or token");
        // User is not logged in, redirect to login page
        window.location.href = '/';
        return false;
    }

    // Update UI with user info if needed
    const userName = localStorage.getItem('userName');
    const userUsername = localStorage.getItem('userUsername');

    // Update user display in navbar if it exists
    const userDisplay = document.getElementById('current-user');
    if (userDisplay && userName) {
        userDisplay.textContent = userName;
    }

    return true;
}

// Get current user from localStorage or API
async function getCurrentUser() {
    try {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('token');

        if (!userId || !token) {
            return null;
        }

        // For now, return user info from localStorage
        // In a real implementation, you might want to fetch fresh data from the API
        return {
            id: userId,
            first_name: localStorage.getItem('userName')?.split(' ')[0] || '',
            last_name: localStorage.getItem('userName')?.split(' ')[1] || '',
            username: localStorage.getItem('userUsername') || ''
        };
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

// Make functions globally available
window.checkAuthentication = checkAuthentication;
window.logout = logout;
window.showAlert = showAlert;
window.getCurrentUser = getCurrentUser;

// Debug: Confirm global functions are set
console.log("Auth functions made globally available:", {
    checkAuthentication: typeof window.checkAuthentication,
    logout: typeof window.logout,
    showAlert: typeof window.showAlert,
    getCurrentUser: typeof window.getCurrentUser
});

// Debug: Confirm global functions are set
console.log("Auth functions made globally available:", {
    checkAuthentication: typeof window.checkAuthentication,
    logout: typeof window.logout,
    showAlert: typeof window.showAlert,
    getCurrentUser: typeof window.getCurrentUser
});

// Initialize login form
document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Check authentication on page load
    checkAuthentication();
});
