import { useState, useEffect } from "react"
import { Routes, Route, useLocation } from "react-router-dom"
import './App.css'
import { AppProvider } from './context/AppContext'
import { RouteErrorBoundary } from './components/ErrorBoundary'
import Login from './components/Login'
import TopNavbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import PublicLeadForm from "./components/PublicLeadForm"
import AppRoutes from './routes/AppRoutes'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedLabel, setSelectedLabel] = useState("Feed")
  const location = useLocation()

  useEffect(() => {
    // Check if user is already logged in
    const userData = localStorage.getItem('userData')
    const authStatus = localStorage.getItem('isAuthenticated')

    if (userData && authStatus === 'true') {
      setUser(JSON.parse(userData))
      setIsAuthenticated(true)
    }
    setLoading(false)
  }, [])

  // Update selected label based on current route
  useEffect(() => {
    const currentPath = location.pathname
    // Find the label that matches the current path
    const matchingLabel = Object.entries({
      'Feed': '/feed',
      'Lead CRM': '/lead-crm',
      'LEAD Dashboard': '/lead-dashboard',
      'Create LEAD': '/create-lead',
      'PL & ODD LEADS': '/pl-odd-leads',
      'Home Loan Updates': '/home-loan-updates',
      'LOGIN Dashboard': '/login-crm',
      'Login CRM': '/login-crm',
      'Charts': '/charts',
      'Ticket': '/tickets',
      'PL & ODD LOGIN': '/pl-odd-login',
      'Home Loan LOGIN': '/home-loan-login',
      'Task': '/tasks',
      'Employees': '/employees',
      'Employees': '/employees',
      'Leaves': '/leaves',
      'Attendance': '/attendance',
      'Warning Management': '/warnings',
      'Warning': '/warnings',
      'Warning Dashboard': '/warnings',
      'All Warnings': '/warnings',
      'My Warnings': '/warnings',
      'Add Task': '/add-task',
      'Settings': '/settings'
    }).find(([_, path]) => path === currentPath)
    
    if (matchingLabel) {
      setSelectedLabel(matchingLabel[0])
    }
  }, [location.pathname])

  // Store selectedLabel in localStorage when it changes
  useEffect(() => {
    localStorage.setItem('selectedLabel', selectedLabel)
  }, [selectedLabel])

  // Listen for sidebar selection changes from components (legacy support)
  useEffect(() => {
    const handleSidebarSelectionChange = (event) => {
      const { selection } = event.detail;
      if (selection) {
        setSelectedLabel(selection);
      }
    };
    
    window.addEventListener('sidebarSelectionChange', handleSidebarSelectionChange);
    return () => window.removeEventListener('sidebarSelectionChange', handleSidebarSelectionChange);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('userData')
    localStorage.removeItem('isAuthenticated')
    setUser(null)
    setIsAuthenticated(false)
  }

  const ProtectedRoute = ({ children }) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-black">
          <div className="text-white text-xl">Loading...</div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return <Login onLogin={handleLogin} />;
    }

    return children;
  };

  return (
    <AppProvider>
      <RouteErrorBoundary routeName="Application">
        <Routes>
          {/* Public route for lead form - no authentication required */}
          <Route path="/public/lead-form/:shareToken" element={<PublicLeadForm />} />

          {/* Protected routes (requires authentication) */}
          <Route path="/*" element={
            <ProtectedRoute>
              <div className="flex h-screen bg-black text-white">
                <Sidebar selectedLabel={selectedLabel} setSelectedLabel={setSelectedLabel} />
                <div className="flex-1 flex flex-col overflow-hidden">
                  <TopNavbar
                    selectedLabel={selectedLabel}
                    userName={`${user?.first_name || ''} ${user?.last_name || ''}`}
                    onLogout={handleLogout}
                    user={user}
                  />
                  <div className="flex-1 overflow-y-auto">
                    <AppRoutes user={user} />
                  </div>
                </div>
              </div>
            </ProtectedRoute>
          } />
        </Routes>
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
      </RouteErrorBoundary>
    </AppProvider>
  )
}

export default App
