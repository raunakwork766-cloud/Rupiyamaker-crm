import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  CircularProgress, 
  Tabs, 
  Tab, 
  IconButton,
  Collapse,
  Tooltip,
  Badge,
  Button,
  Grid,
  Avatar,
  Chip,
  Paper,
  useTheme,
  useMediaQuery,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Container
} from '@mui/material';
import { 
  Business as DepartmentIcon,
  Person as UserIcon,
  Group as RoleIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  WorkOutline as JobIcon,
  AccountTree as HierarchyIcon,
  Dashboard as DashboardIcon,
  Add as AddIcon,
  Groups as GroupsIcon,
  PersonOutline as PersonOutlineIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowRight as ArrowRightIcon
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use API proxy

// Styled components for modern responsive design
const StyledCard = styled(Card)(({ theme, cardType }) => ({
  borderRadius: 16,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  border: '1px solid',
  borderColor: cardType === 'department' ? theme.palette.warning.main : 
               cardType === 'role' ? theme.palette.primary.main : 
               theme.palette.grey[300],
  backgroundColor: theme.palette.background.paper,
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8],
    borderColor: cardType === 'department' ? theme.palette.warning.dark : 
                 cardType === 'role' ? theme.palette.primary.dark : 
                 theme.palette.grey[400],
  },
  '&.expanded': {
    backgroundColor: alpha(
      cardType === 'department' ? theme.palette.warning.main : 
      cardType === 'role' ? theme.palette.primary.main : 
      theme.palette.grey[100], 
      0.05
    )
  }
}));

const StyledChip = styled(Chip)(({ theme, chipType }) => ({
  borderRadius: 20,
  fontWeight: 600,
  backgroundColor: chipType === 'users' ? alpha(theme.palette.success.main, 0.1) :
                  chipType === 'roles' ? alpha(theme.palette.info.main, 0.1) :
                  alpha(theme.palette.grey[500], 0.1),
  color: chipType === 'users' ? theme.palette.success.main :
         chipType === 'roles' ? theme.palette.info.main :
         theme.palette.grey[700],
  '& .MuiChip-icon': {
    color: 'inherit'
  }
}));

const OrganizationContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  height: '100vh',
  width: '100%',
  backgroundColor: '#000000',
  paddingTop: theme.spacing(2),
  paddingBottom: theme.spacing(2),
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  [theme.breakpoints.down('sm')]: {
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
  }
}));

const HeaderCard = styled(Paper)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
  color: 'white',
  padding: theme.spacing(2),
  borderRadius: 16,
  marginBottom: theme.spacing(2),
  flexShrink: 0,
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1.5),
  }
}));

// Modern Family Tree Specific Styles - Centered Tree Layout
const FamilyTreeContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: theme.spacing(1.8), // Reduced by 10%
  position: 'relative',
  padding: theme.spacing(0.9), // Reduced by 10%
  height: '100%',
  width: '100%',
  overflow: 'auto',
  transform: 'scale(1)',
  transformOrigin: 'center top',
  '&::-webkit-scrollbar': {
    width: 6,
    height: 6,
  },
  '&::-webkit-scrollbar-track': {
    background: alpha(theme.palette.grey[300], 0.2),
    borderRadius: 3,
  },
  '&::-webkit-scrollbar-thumb': {
    background: alpha(theme.palette.primary.main, 0.3),
    borderRadius: 3,
    '&:hover': {
      background: alpha(theme.palette.primary.main, 0.5),
    }
  },
  [theme.breakpoints.down('md')]: {
    transform: 'scale(0.9)',
    gap: theme.spacing(1.35), // Reduced by 10%
    padding: theme.spacing(0.9), // Reduced by 10%
  },
  [theme.breakpoints.down('sm')]: {
    transform: 'scale(0.8)',
    gap: theme.spacing(1.08), // Reduced by 10%
    padding: theme.spacing(0.45), // Reduced by 10%
  }
}));

const TreeLevel = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  gap: theme.spacing(1.35), // Reduced by 10%
  width: '100%',
  minWidth: 'max-content',
  position: 'relative',
  flexWrap: 'nowrap',
  [theme.breakpoints.down('md')]: {
    gap: theme.spacing(1.08), // Reduced by 10%
    flexWrap: 'wrap',
  },
  [theme.breakpoints.down('sm')]: {
    gap: theme.spacing(0.9), // Reduced by 10%
    justifyContent: 'center',
    flexWrap: 'wrap',
  }
}));

const TreeBranch = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  position: 'relative',
  minWidth: 'max-content',
  
  // Vertical connection line from parent
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -24,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 2,
    height: 24,
    background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.4)} 0%, ${alpha(theme.palette.primary.main, 0.6)} 100%)`,
    borderRadius: 1,
    zIndex: 1
  },
  
  // First child doesn't need the vertical line
  '&:first-of-type::before': {
    display: 'none'
  }
}));

const ConnectionLines = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: -12,
  left: '0%',
  right: '0%',
  height: 2,
  background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.4)} 0%, ${alpha(theme.palette.primary.main, 0.6)} 50%, ${alpha(theme.palette.primary.main, 0.4)} 100%)`,
  borderRadius: 1,
  zIndex: 0,
  
  // Center connection point
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -11,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 2,
    height: 12,
    background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.6)} 0%, ${alpha(theme.palette.primary.main, 0.4)} 100%)`,
    borderRadius: 1,
    zIndex: 1
  }
}));

const TreeNode = styled(Box)(({ theme, isRoot = false }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  position: 'relative',
  marginBottom: theme.spacing(1.5),
  minWidth: isRoot ? 162 : 144, // Reduced by 10%
  maxWidth: isRoot ? 198 : 180, // Reduced by 10%
  
  [theme.breakpoints.down('md')]: {
    minWidth: isRoot ? 144 : 126, // Reduced by 10%
    maxWidth: isRoot ? 180 : 162, // Reduced by 10%
  },
  
  [theme.breakpoints.down('sm')]: {
    minWidth: isRoot ? 126 : 108, // Reduced by 10%
    maxWidth: isRoot ? 162 : 144, // Reduced by 10%
  }
}));

const NodeCard = styled(Card)(({ theme, nodeType, isExpanded, isRoot = false }) => ({
  borderRadius: 6,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  border: '2px solid',
  borderColor: nodeType === 'department' ? theme.palette.warning.main : 
               nodeType === 'role' ? theme.palette.primary.main : 
               nodeType === 'user' ? theme.palette.success.main :
               theme.palette.grey[300],
  backgroundColor: isExpanded ? 
    alpha(nodeType === 'department' ? theme.palette.warning.main : 
          nodeType === 'role' ? theme.palette.primary.main : 
          nodeType === 'user' ? theme.palette.success.main : 
          theme.palette.grey[100], 0.08) :
    theme.palette.background.paper,
  boxShadow: isExpanded ? theme.shadows[4] : theme.shadows[1],
  width: '100%',
  minHeight: isRoot ? 75 : 65,
  
  '&:hover': {
    transform: 'translateY(-1px) scale(1.02)',
    boxShadow: theme.shadows[6],
    borderColor: nodeType === 'department' ? theme.palette.warning.dark : 
                 nodeType === 'role' ? theme.palette.primary.dark : 
                 nodeType === 'user' ? theme.palette.success.dark :
                 theme.palette.grey[400],
  },
  
  zIndex: 3,
  position: 'relative',
  
  // Glow effect for root nodes
  ...(isRoot && {
    '&::before': {
      content: '""',
      position: 'absolute',
      top: -1,
      left: -1,
      right: -1,
      bottom: -1,
      borderRadius: 8,
      background: `linear-gradient(45deg, ${alpha(nodeType === 'department' ? theme.palette.warning.main : theme.palette.primary.main, 0.2)}, ${alpha(nodeType === 'department' ? theme.palette.warning.main : theme.palette.primary.main, 0.1)})`,
      zIndex: -1,
      opacity: isExpanded ? 1 : 0.5,
      transition: 'opacity 0.3s ease'
    }
  })
}));

const UserGrid = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: theme.spacing(1.35), // Reduced by 10%
  marginTop: theme.spacing(1.8), // Reduced by 10%
  marginBottom: theme.spacing(1.8), // Reduced by 10%
  padding: theme.spacing(2.25), // Reduced by 10%
  borderRadius: 12,
  backgroundColor: alpha(theme.palette.grey[100], 0.7),
  border: `2px dashed ${alpha(theme.palette.grey[400], 0.8)}`,
  
  [theme.breakpoints.down('sm')]: {
    gap: theme.spacing(1.08), // Reduced by 10%
    padding: theme.spacing(1.8), // Reduced by 10%
  }
}));

const ChartPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [tabValue, setTabValue] = useState(2); // Start with Organization Structure
  const [loading, setLoading] = useState(true);
  const [departmentData, setDepartmentData] = useState([]);
  const [roleData, setRoleData] = useState([]);
  const [orgStructure, setOrgStructure] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState({});

  // Permission state
  const [permissions, setPermissions] = useState({});
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(null);

  const userId = localStorage.getItem('userId');

  // Check if user has charts permission - enhanced to handle multiple permission formats
  const hasChartsPermission = () => {
    // If permissions is null/undefined, return false
    if (!permissions) {
      console.log('Permissions object is null or undefined');
      return false;
    }
    
    // Check for super admin permissions first (pages:"*" and actions:"*")
    if (permissions['pages'] === '*' && permissions['actions'] === '*') {
      return true;
    }
    
    // Check for Global wildcard permission
    if (permissions['Global'] === '*' || permissions['global'] === '*' || permissions['*'] === '*') {
      return true;
    }
    
    // Check for permissions array with objects (new permission format)
    if (Array.isArray(permissions)) {
      // Look for Charts permission in the array
      for (const perm of permissions) {
        if (!perm || !perm.page) continue;
        
        // Check if this is a charts permission entry
        if (perm.page === 'Charts' || perm.page === 'charts') {
          // Check if actions is a wildcard
          if (perm.actions === '*') {
            return true;
          }
          
          // Check if actions is an array containing 'show'
          if (Array.isArray(perm.actions) && 
              (perm.actions.includes('*') || perm.actions.includes('show'))) {
            return true;
          }
          
          // Check if actions is a string matching 'show'
          if (perm.actions === 'show') {
            return true;
          }
        }
        
        // Check for global permission
        if ((perm.page === '*' || perm.page === 'any' || perm.page === 'Global') && 
            (perm.actions === '*' || 
             (Array.isArray(perm.actions) && 
              (perm.actions.includes('*') || perm.actions.includes('show'))))) {
          return true;
        }
      }
    }
    
    // Check legacy permission formats
    const chartsUpper = permissions['Charts'];
    const chartsLower = permissions['charts'];
    
    // Check if permissions are wildcard
    if (chartsUpper === '*' || chartsLower === '*') {
      return true;
    }
    
    // Check if the permissions are arrays before calling includes()
    const hasShowInUpper = Array.isArray(chartsUpper) && chartsUpper.includes('show');
    const hasShowInLower = Array.isArray(chartsLower) && chartsLower.includes('show');
    
    // Handle object format permissions
    const hasShowInUpperObj = typeof chartsUpper === 'object' && 
                             !Array.isArray(chartsUpper) && 
                             chartsUpper?.show === true;
    const hasShowInLowerObj = typeof chartsLower === 'object' && 
                             !Array.isArray(chartsLower) && 
                             chartsLower?.show === true;
    
    return hasShowInUpper || hasShowInLower || hasShowInUpperObj || hasShowInLowerObj;
  };

  // Load user permissions - enhanced to handle different response formats
  const loadPermissions = async () => {
    setPermissionsLoading(true);
    setPermissionError(null);
    
    try {
      // Don't try to load permissions if userId is not available
      if (!userId) {
        console.error('No userId available, cannot load permissions');
        throw new Error('User ID is required to load permissions');
      }
      
      console.log('ChartPage: Loading permissions for user ID:', userId);
      
      // First try to get permissions from localStorage
      const storedPermissions = localStorage.getItem('userPermissions');
      if (storedPermissions) {
        try {
          const parsedPermissions = JSON.parse(storedPermissions);
          console.log('ChartPage: Loaded permissions from localStorage:', parsedPermissions);
          setPermissions(parsedPermissions);
          setPermissionsLoading(false);
          return;
        } catch (parseError) {
          console.error('Error parsing stored permissions:', parseError);
          // Clear corrupt data
          localStorage.removeItem('userPermissions');
        }
      }
      
      // Fallback to API if localStorage is empty or parsing failed
      const response = await axios.get(`${API_BASE_URL}/users/permissions/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('API response for permissions:', response.data);
      
      // Handle different permission formats
      let formattedPermissions;
      
      // Handle array format (new format directly returned by backend)
      if (Array.isArray(response.data)) {
        formattedPermissions = response.data;
        console.log('Using array format permissions directly from API response');
      } 
      // Handle permissions property containing array
      else if (Array.isArray(response.data.permissions)) {
        formattedPermissions = response.data.permissions;
        console.log('Using permissions array from data.permissions property');
      }
      // Handle permissions property containing object
      else if (response.data.permissions && typeof response.data.permissions === 'object') {
        formattedPermissions = response.data.permissions;
        console.log('Using permissions object from data.permissions property');
      }
      // Handle role permissions from direct response
      else if (response.data.role && response.data.role.permissions) {
        formattedPermissions = response.data.role.permissions;
        console.log('Using permissions from user role');
      }
      // Message from backend with no permissions
      else if (response.data.message && !response.data.permissions) {
        console.warn('Server message:', response.data.message);
        // Create empty permissions object to avoid errors
        formattedPermissions = [];
        setPermissionError(`Permission issue: ${response.data.message}`);
      }
      // Fallback - use raw data
      else {
        console.warn('Unexpected permissions format, using raw data');
        formattedPermissions = response.data;
      }
      
      // Store in localStorage for future use
      localStorage.setItem('userPermissions', JSON.stringify(formattedPermissions));
      
      console.log('Using formatted permissions:', formattedPermissions);
      setPermissions(formattedPermissions);
    } catch (error) {
      console.error('Error loading permissions:', error);
      setPermissionError(error.message || 'Failed to load permissions. Please try again.');
    } finally {
      setPermissionsLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, [userId]);

  useEffect(() => {
    if (!permissionsLoading && hasChartsPermission()) {
      fetchDataForActiveTab();
    } else if (!permissionsLoading && !hasChartsPermission()) {
      setLoading(false);
    }
  }, [tabValue, permissionsLoading, permissions]);

  // Utility function to check if data is empty
  const isDataEmpty = () => {
    switch (tabValue) {
      case 0:
        return !departmentData || departmentData.length === 0;
      case 1:
        return !roleData || roleData.length === 0;
      case 2:
        return !orgStructure || orgStructure.length === 0;
      default:
        return false;
    }
  };

  const fetchDataForActiveTab = async () => {
    setLoading(true);
    setError(null);
    
    try {
      switch (tabValue) {
        case 0: // Department hierarchy
          await fetchDepartmentHierarchy();
          break;
        case 1: // Role hierarchy
          await fetchRoleHierarchy();
          break;
        case 2: // Organization structure
          await fetchOrganizationStructure();
          break;
        default:
          await fetchOrganizationStructure();
      }
      
      // We'll handle empty data directly in the renderContent function
      // rather than setting an error, which allows for a more tailored
      // user experience with the "create sample data" option
    } catch (err) {
      console.error("Error fetching chart data:", err);
      
      // Provide a more helpful error message based on the type of error
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("You don't have permission to access this data. Please contact your administrator.");
      } else if (err.response?.status === 404) {
        setError("The requested data could not be found. You may need to create sample data first.");
      } else if (typeof err.message === 'string' && err.message.includes('Network')) {
        setError("Network error. Please check your internet connection and try again.");
      } else {
        setError(err.response?.data?.message || err.message || "Failed to load organization data. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentHierarchy = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/charts/department-hierarchy?user_id=${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data) {
        throw new Error('No data received from server');
      }
      
      setDepartmentData(response.data.departments || []);
      setSummary(response.data.summary || {});
    } catch (err) {
      console.error('Error fetching department hierarchy:', err);
      throw new Error(
        err.response?.data?.message || 
        err.response?.data?.detail || 
        'Failed to load department hierarchy. Please check your connection.'
      );
    }
  };

  const fetchRoleHierarchy = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/charts/role-hierarchy?user_id=${userId}&include_users=true`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data) {
        throw new Error('No data received from server');
      }
      
      setRoleData(response.data.roles || []);
      setSummary(response.data.summary || {});
    } catch (err) {
      console.error('Error fetching role hierarchy:', err);
      throw new Error(
        err.response?.data?.message || 
        err.response?.data?.detail || 
        'Failed to load role hierarchy. Please check your connection.'
      );
    }
  };

  const fetchOrganizationStructure = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/charts/organization-structure?user_id=${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.data) {
        throw new Error('No data received from server');
      }
      
      setOrgStructure(response.data.organization || []);
      setSummary(response.data.summary || {});
    } catch (err) {
      console.error('Error fetching organization structure:', err);
      throw new Error(
        err.response?.data?.message || 
        err.response?.data?.detail || 
        'Failed to load organization structure. Please check your connection.'
      );
    }
  };

  const createSampleData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Make sure we have a user ID
      if (!userId) {
        throw new Error('User ID is required to create sample data. Please log in again.');
      }
      
      const response = await axios.post(
        `${API_BASE_URL}/charts/create-sample-data?user_id=${userId}`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        console.log('Sample data created successfully:', response.data);
        await fetchDataForActiveTab();
      } else {
        throw new Error(response.data.message || 'Unknown error creating sample data');
      }
    } catch (err) {
      console.error('Error creating sample data:', err);
      
      // Provide more helpful error messages based on the type of error
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Permission denied. You need admin privileges to create sample data.');
      } else if (typeof err.message === 'string' && err.message.includes('Network')) {
        setError('Network error while creating sample data. Please check your internet connection.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to create sample data. You may need admin permissions.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setExpandedNodes({}); // Reset expanded state when switching tabs
  };

  const toggleNodeExpand = (nodeId) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // Modern Family Tree Rendering Functions
  const renderModernFamilyTreeUser = (user) => (
    <Box 
      key={user._id} 
      sx={{ 
        minWidth: 126, // Reduced by 10%
        maxWidth: 144, // Reduced by 10%
        mb: 0.8
      }}
    >
      <NodeCard nodeType="user" isExpanded={false} sx={{ cursor: 'default' }}>
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar 
              sx={{ 
                bgcolor: theme.palette.success.main, 
                width: 32, 
                height: 32,
                fontSize: '0.9rem',
                fontWeight: 'bold'
              }}
            >
              {user.name ? user.name.charAt(0).toUpperCase() : <PersonOutlineIcon fontSize="small" />}
            </Avatar>
            <Box flex={1} minWidth={0}>
              <Typography 
                variant="caption" 
                fontWeight="700" 
                noWrap 
                color="text.primary" 
                sx={{ 
                  fontSize: '0.8rem', 
                  lineHeight: 1.2,
                  display: 'block',
                  mb: 0.3
                }}
              >
                {user.name || 'Unnamed User'}
              </Typography>
              {user.email && (
                <Typography 
                  variant="caption" 
                  color="text.secondary" 
                  noWrap 
                  sx={{ 
                    fontSize: '0.65rem', 
                    display: 'block', 
                    lineHeight: 1.1, 
                    mb: 0.2,
                    fontWeight: 500
                  }}
                >
                  {user.email}
                </Typography>
              )}
              {user.job_title && (
                <Typography 
                  variant="caption" 
                  color="text.secondary" 
                  noWrap 
                  sx={{ 
                    fontSize: '0.65rem', 
                    display: 'block', 
                    lineHeight: 1.1,
                    fontStyle: 'italic',
                    fontWeight: 400
                  }}
                >
                  {user.job_title}
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
      </NodeCard>
    </Box>
  );

  const renderModernFamilyTreeRole = (role, isRoot = false) => {
    const isExpanded = expandedNodes[role._id];
    const users = role.children?.filter(child => child.type === 'user') || [];
    const subRoles = role.children?.filter(child => child.type === 'role') || [];
    const hasChildren = users.length > 0 || subRoles.length > 0;

    return (
      <TreeBranch key={role._id}>
        <Box sx={{ 
          minWidth: isRoot ? 240 : 220, // Further increased width for role cards
          maxWidth: isRoot ? 300 : 280, // Further increased width for role cards
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          marginBottom: 1.5,
        }}>
          <NodeCard 
            nodeType="role" 
            isExpanded={isExpanded}
            isRoot={isRoot}
            onClick={() => hasChildren && toggleNodeExpand(role._id)}
            sx={{ 
              cursor: hasChildren ? 'pointer' : 'default',
              width: '100%',
              minHeight: isRoot ? 75 : 65 // Reset to original height
            }}
          >
            <CardContent sx={{ p: isRoot ? 2 : 1.5 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center" gap={1.5} flex={1} minWidth={0}>
                  <Avatar 
                    sx={{ 
                      bgcolor: theme.palette.primary.main, 
                      width: isRoot ? 36 : 32, // Reset to original avatar size
                      height: isRoot ? 36 : 32, 
                      fontWeight: 'bold' 
                    }}
                  >
                    <RoleIcon fontSize={isRoot ? "medium" : "small"} />
                  </Avatar>
                  <Box flex={1} minWidth={0}>
                    <Typography 
                      variant="caption" 
                      fontWeight="800" 
                      sx={{ 
                        lineHeight: 1.4, // Increased line height for roles
                        fontSize: isRoot ? '0.95rem' : '0.85rem', // Slightly larger font for roles
                        display: 'block',
                        mb: 0.4, // More spacing
                        color: 'text.primary',
                        wordBreak: 'break-word' // Prevent text overflow
                      }}
                    >
                      {role.name}
                    </Typography>
                    {role.description && (
                      <Typography 
                        variant="caption" 
                        color="text.secondary" 
                        sx={{ 
                          fontSize: '0.75rem', // Slightly larger for roles
                          lineHeight: 1.3, // Better line spacing
                          display: 'block',
                          mb: 0.3, // More spacing
                          fontWeight: 500,
                          wordBreak: 'break-word', // Prevent text overflow
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'normal' // Allow wrapping for longer descriptions
                        }}
                      >
                        {role.description}
                      </Typography>
                    )}
                    {isRoot && (
                      <Typography 
                        variant="caption" 
                        color="primary" 
                        sx={{ 
                          fontWeight: 700, 
                          fontSize: '0.75rem', // Slightly larger for root indicator
                          lineHeight: 1.3, 
                          display: 'block',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}
                      >
                        Root Role
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  {users.length > 0 && (
                    <StyledChip 
                      chipType="users"
                      icon={<PersonOutlineIcon fontSize="small" />}
                      label={users.length}
                      size="small"
                      sx={{ 
                        height: 20, 
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        '& .MuiChip-label': {
                          px: 1
                        }
                      }}
                    />
                  )}
                  {subRoles.length > 0 && (
                    <StyledChip 
                      chipType="roles"
                      icon={<RoleIcon fontSize="small" />}
                      label={subRoles.length}
                      size="small"
                      sx={{ 
                        height: 20, 
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        '& .MuiChip-label': {
                          px: 1
                        }
                      }}
                    />
                  )}
                  {hasChildren && (
                    <IconButton size="small" sx={{ p: 0.3 }}>
                      {isExpanded ? <ArrowDownIcon fontSize="small" /> : <ArrowRightIcon fontSize="small" />}
                    </IconButton>
                  )}
                </Stack>
              </Box>
            </CardContent>
          </NodeCard>

          {/* Children */}
          <Collapse in={isExpanded}>
            <Box sx={{ mt: 2, width: '100%' }}>
              {/* Users */}
              {users.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography 
                    variant="caption" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 2,
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      display: 'block',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      pb: 0.5
                    }}
                  >
                    Team Members ({users.length})
                  </Typography>
                  <UserGrid>
                    {users.map(user => renderModernFamilyTreeUser(user))}
                  </UserGrid>
                </Box>
              )}

              {/* Sub-roles */}
              {subRoles.length > 0 && (
                <Box>
                  <Typography 
                    variant="caption" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 2,
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      display: 'block',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      pb: 0.5
                    }}
                  >
                    Sub-Roles ({subRoles.length})
                  </Typography>
                  <TreeLevel>
                    {subRoles.length > 1 && <ConnectionLines />}
                    {subRoles.map(subRole => renderModernFamilyTreeRole(subRole, false))}
                  </TreeLevel>
                </Box>
              )}
            </Box>
          </Collapse>
        </Box>
      </TreeBranch>
    );
  };

  const renderModernFamilyTreeDepartment = (dept, isRoot = false) => {
    const isExpanded = expandedNodes[dept._id];
    const subDepartments = dept.children?.filter(child => child.type === 'department') || [];
    const roles = dept.children?.filter(child => child.type === 'role') || [];
    const hasChildren = subDepartments.length > 0 || roles.length > 0;

    return (
      <TreeBranch key={dept._id}>
        <TreeNode isRoot={isRoot}>
          <NodeCard 
            nodeType="department" 
            isExpanded={isExpanded}
            isRoot={isRoot}
            onClick={() => hasChildren && toggleNodeExpand(dept._id)}
            sx={{ cursor: hasChildren ? 'pointer' : 'default' }}
          >
            <CardContent sx={{ p: isRoot ? 2 : 1.5 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center" gap={1.5} flex={1} minWidth={0}>
                  <Avatar 
                    sx={{ 
                      bgcolor: theme.palette.warning.main, 
                      width: isRoot ? 36 : 32, 
                      height: isRoot ? 36 : 32,
                      fontWeight: 'bold'
                    }}
                  >
                    <DepartmentIcon fontSize={isRoot ? "medium" : "small"} />
                  </Avatar>
                  <Box flex={1} minWidth={0}>
                    <Typography 
                      variant="caption" 
                      fontWeight="800" 
                      noWrap
                      sx={{ 
                        lineHeight: 1.3, 
                        fontSize: isRoot ? '0.9rem' : '0.8rem',
                        display: 'block',
                        mb: 0.3,
                        color: 'text.primary'
                      }}
                    >
                      {dept.name}
                    </Typography>
                    {dept.description && (
                      <Typography 
                        variant="caption" 
                        color="text.secondary" 
                        noWrap 
                        sx={{ 
                          fontSize: '0.7rem', 
                          lineHeight: 1.2, 
                          display: 'block',
                          mb: 0.2,
                          fontWeight: 500
                        }}
                      >
                        {dept.description}
                      </Typography>
                    )}
                    <Typography 
                      variant="caption" 
                      color="warning.main" 
                      sx={{ 
                        fontWeight: 700, 
                        fontSize: '0.7rem', 
                        lineHeight: 1.2, 
                        display: 'block',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                    >
                      {isRoot ? 'Root Department' : 'Sub-Department'}
                    </Typography>
                  </Box>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  {dept.user_count > 0 && (
                    <StyledChip 
                      chipType="users"
                      icon={<PersonOutlineIcon fontSize="small" />}
                      label={`${dept.user_count}`}
                      size="small"
                      sx={{ 
                        height: 20, 
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        '& .MuiChip-label': {
                          px: 1
                        }
                      }}
                    />
                  )}
                  {dept.role_count > 0 && (
                    <StyledChip 
                      chipType="roles"
                      icon={<RoleIcon fontSize="small" />}
                      label={`${dept.role_count}`}
                      size="small"
                      sx={{ 
                        height: 20, 
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        '& .MuiChip-label': {
                          px: 1
                        }
                      }}
                    />
                  )}
                  {subDepartments.length > 0 && (
                    <StyledChip 
                      chipType="departments"
                      icon={<DepartmentIcon fontSize="small" />}
                      label={`${subDepartments.length}`}
                      size="small"
                      sx={{
                        backgroundColor: alpha(theme.palette.warning.main, 0.1),
                        color: theme.palette.warning.main,
                        height: 20,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        '& .MuiChip-label': {
                          px: 1
                        }
                      }}
                    />
                  )}
                  {hasChildren && (
                    <IconButton size="small" sx={{ p: 0.3 }}>
                      {isExpanded ? <ArrowDownIcon fontSize="small" /> : <ArrowRightIcon fontSize="small" />}
                    </IconButton>
                  )}
                </Stack>
              </Box>
            </CardContent>
          </NodeCard>

          {/* Children */}
          <Collapse in={isExpanded}>
            <Box sx={{ mt: 2, width: '100%' }}>
              {/* Roles */}
              {roles.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography 
                    variant="caption" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 2,
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      display: 'block',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      pb: 0.5
                    }}
                  >
                    Department Roles ({roles.length})
                  </Typography>
                  <TreeLevel>
                    {roles.length > 1 && <ConnectionLines />}
                    {roles.map(role => renderModernFamilyTreeRole(role, false))}
                  </TreeLevel>
                </Box>
              )}

              {/* Sub-departments */}
              {subDepartments.length > 0 && (
                <Box>
                  <Typography 
                    variant="caption" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 2,
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      display: 'block',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      pb: 0.5
                    }}
                  >
                    Sub-Departments ({subDepartments.length})
                  </Typography>
                  <TreeLevel>
                    {subDepartments.length > 1 && <ConnectionLines />}
                    {subDepartments.map(subDept => renderModernFamilyTreeDepartment(subDept, false))}
                  </TreeLevel>
                </Box>
              )}
            </Box>
          </Collapse>
        </TreeNode>
      </TreeBranch>
    );
  };

  const getTabData = () => {
    switch (tabValue) {
      case 0: return departmentData;
      case 1: return roleData;
      case 2: return orgStructure;
      default: return [];
    }
  };

  const renderContent = () => {
    const data = getTabData();
    
    if (!data || data.length === 0) {
      const getTabSpecificMessage = () => {
        switch (tabValue) {
          case 0:
            return {
              title: 'No Department Data Found',
              message: 'There are no departments defined in the system yet. Create sample data or ask your administrator to add departments.'
            };
          case 1:
            return {
              title: 'No Role Data Found',
              message: 'There are no roles defined in the system yet. Create sample data or ask your administrator to add roles.'
            };
          case 2:
            return {
              title: 'No Organization Structure Found',
              message: 'The organization structure hasn\'t been defined yet. Create sample data to see how it works.'
            };
          default:
            return {
              title: 'No Data Available',
              message: 'No chart data is available for this view.'
            };
        }
      };
      
      const { title, message } = getTabSpecificMessage();
      
      return (
        <Box 
          display="flex" 
          flexDirection="column" 
          alignItems="center" 
          justifyContent="center" 
          minHeight="400px"
          textAlign="center"
          px={3}
        >
          <DashboardIcon sx={{ fontSize: 64, color: 'white', mb: 2, opacity: 0.8 }} />
          <Typography variant="h5" color="white" fontWeight="500" gutterBottom>
            {title}
          </Typography>
          <Typography variant="body1" color="rgba(255,255,255,0.7)" mb={4} maxWidth="600px">
            {message}
          </Typography>
          <Stack direction={isMobile ? "column" : "row"} spacing={2}>
            <Button 
              variant="contained" 
              onClick={fetchDataForActiveTab}
              startIcon={<RefreshIcon />}
              size="large"
            >
              Refresh Data
            </Button>
            <Button 
              variant="outlined" 
              onClick={createSampleData}
              startIcon={<DashboardIcon />}
              color="warning"
              size="large"
              sx={{ mt: isMobile ? 1 : 0 }}
            >
              Create Sample Data
            </Button>
          </Stack>
        </Box>
      );
    }

    // All tabs now render as centered family trees with proper hierarchy
    return (
      <FamilyTreeContainer>
        <TreeLevel>
          {data.length > 1 && <ConnectionLines />}
          {tabValue === 0 && data.map(dept => renderModernFamilyTreeDepartment(dept, true))}
          {tabValue === 1 && data.map(role => renderModernFamilyTreeRole(role, true))}
          {tabValue === 2 && data.map(node => renderModernFamilyTreeDepartment(node, true))}
        </TreeLevel>
      </FamilyTreeContainer>
    );
  };

  // Show loading while checking permissions
  if (permissionsLoading) {
    return (
      <Box 
        display="flex" 
        flexDirection="column" 
        alignItems="center" 
        justifyContent="center" 
        minHeight="100vh"
        sx={{ backgroundColor: '#000000' }}
      >
        <CircularProgress size={60} sx={{ mb: 2, color: 'white' }} />
        <Typography variant="h6" color="white">
          Loading permissions...
        </Typography>
      </Box>
    );
  }

  // Show permission error with retry button
  if (permissionError) {
    return (
      <Box 
        display="flex" 
        flexDirection="column" 
        alignItems="center" 
        justifyContent="center" 
        minHeight="100vh"
        sx={{ backgroundColor: '#000000' }}
      >
        <Typography variant="h4" color="white" gutterBottom>
          Permission Error
        </Typography>
        <Typography variant="body1" color="grey.300" sx={{ mb: 3, maxWidth: '600px', textAlign: 'center' }}>
          {permissionError}
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={() => loadPermissions()}
          startIcon={<RefreshIcon />}
        >
          Retry Loading Permissions
        </Button>
      </Box>
    );
  }

  // Check if user has charts permission
  if (!hasChartsPermission()) {
    return (
      <Box 
        display="flex" 
        flexDirection="column" 
        alignItems="center" 
        justifyContent="center" 
        minHeight="100vh"
        sx={{ backgroundColor: '#000000' }}
      >
        <Typography variant="h4" color="white" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body1" color="grey.300" sx={{ mb: 3 }}>
          You don't have permission to view charts.
        </Typography>
        <Button 
          variant="outlined" 
          color="primary" 
          onClick={() => loadPermissions()}
          startIcon={<RefreshIcon />}
        >
          Refresh Permissions
        </Button>
      </Box>
    );
  }

  return (
    <OrganizationContainer>
      {/* Header */}
      <HeaderCard elevation={0}>
        <Grid container alignItems="center" justifyContent="space-between" spacing={2}>
          <Grid item xs={12} md={8}>
            <Typography variant={isMobile ? "h5" : "h4"} fontWeight="700" gutterBottom>
              Organization Family Tree
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Interactive family tree view of departments, roles, and team members with expandable hierarchy
            </Typography>
          </Grid>
          <Grid item xs={12} md={4} display="flex" justifyContent={isMobile ? "flex-start" : "flex-end"}>
            <Stack direction="row" spacing={2} alignItems="center">
              {Object.keys(summary).length > 0 && (
                <Box textAlign="center">
                  <Typography variant="h6" fontWeight="700">
                    {summary.total_departments || summary.total_roles || summary.total_users || 0}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    {tabValue === 0 ? 'Departments' : 
                     tabValue === 1 ? 'Roles' : 
                     'Total Nodes'}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Grid>
        </Grid>
      </HeaderCard>

      {/* Navigation Tabs */}
      <Paper elevation={1} sx={{ borderRadius: 2, mb: 2, bgcolor: '#000000', border: '1px solid #333', flexShrink: 0 }}>
        <Box sx={{ borderBottom: 1, borderColor: '#333' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            variant={isMobile ? "fullWidth" : "standard"}
            centered={!isMobile}
            sx={{
              '& .MuiTab-root': {
                minHeight: 40,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: 'white',
                '&.Mui-selected': {
                  color: '#1976d2'
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#1976d2'
              }
            }}
          >
            <Tab 
              icon={<DepartmentIcon />} 
              label="Department Tree" 
              iconPosition="start"
            />
            <Tab 
              icon={<RoleIcon />} 
              label="Role Tree" 
              iconPosition="start"
            />
            <Tab 
              icon={<HierarchyIcon />} 
              label="Organization Tree" 
              iconPosition="start"
            />
          </Tabs>
        </Box>
      </Paper>

      {/* Error Display */}
      {error && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'error.light', color: 'error.contrastText', borderRadius: 2, flexShrink: 0 }}>
          <Box display="flex" flexDirection={isMobile ? "column" : "row"} alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>
                Error Loading Chart Data
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>{error}</Typography>
            </Box>
            <Stack direction={isMobile ? "column" : "row"} spacing={2}>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={fetchDataForActiveTab}
                startIcon={<RefreshIcon />}
                sx={{ mt: isMobile ? 2 : 0 }}
              >
                Try Again
              </Button>
              <Button 
                variant="outlined" 
                color="secondary"
                onClick={createSampleData}
                startIcon={<DashboardIcon />}
                sx={{ mt: isMobile ? 1 : 0 }}
              >
                Create Sample Data
              </Button>
            </Stack>
          </Box>
        </Paper>
      )}

      {/* Content */}
      <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: '#000000', border: '1px solid #333', flex: 1, minHeight: 0 }}>
        <Box sx={{ p: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <Box 
              display="flex" 
              flexDirection="column" 
              alignItems="center" 
              justifyContent="center" 
              flex={1}
            >
              <CircularProgress size={60} sx={{ mb: 2, color: 'white' }} />
              <Typography variant="h6" color="white">
                Loading organization data...
              </Typography>
            </Box>
          ) : (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Toolbar */}
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} sx={{ flexShrink: 0 }}>
                <Typography variant="subtitle1" color="white">
                  {tabValue === 0 ? 'Department Family Tree' :
                   tabValue === 1 ? 'Role Family Tree' :
                   'Complete Organization Family Tree'}
                </Typography>
                <Button 
                  variant="outlined" 
                  onClick={fetchDataForActiveTab}
                  startIcon={<RefreshIcon />}
                  size="small"
                  sx={{ 
                    borderColor: 'white', 
                    color: 'white',
                    '&:hover': {
                      borderColor: '#ccc',
                      backgroundColor: 'rgba(255,255,255,0.1)'
                    }
                  }}
                >
                  Refresh
                </Button>
              </Box>

              {/* Chart Content */}
              <Box sx={{ flex: 1, minHeight: 0 }}>
                {renderContent()}
              </Box>
            </Box>
          )}
        </Box>
      </Paper>
    </OrganizationContainer>
  );
};

export default ChartPage;
