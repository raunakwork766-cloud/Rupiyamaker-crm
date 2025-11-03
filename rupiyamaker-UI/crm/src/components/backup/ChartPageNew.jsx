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

const OrganizationContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  backgroundColor: theme.palette.grey[50],
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
  }
}));

const HeaderCard = styled(Paper)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
  color: 'white',
  padding: theme.spacing(3),
  borderRadius: 16,
  marginBottom: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  }
}));

// Modern Family Tree Specific Styles - Centered Tree Layout
const FamilyTreeContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(4),
  position: 'relative',
  padding: theme.spacing(3),
  minHeight: '400px',
  width: '100%',
  overflowX: 'auto',
  overflowY: 'visible',
  '&::-webkit-scrollbar': {
    height: 8,
  },
  '&::-webkit-scrollbar-track': {
    background: alpha(theme.palette.grey[300], 0.3),
    borderRadius: 4,
  },
  '&::-webkit-scrollbar-thumb': {
    background: alpha(theme.palette.primary.main, 0.4),
    borderRadius: 4,
    '&:hover': {
      background: alpha(theme.palette.primary.main, 0.6),
    }
  }
}));

const TreeLevel = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  gap: theme.spacing(3),
  width: '100%',
  minWidth: 'max-content',
  position: 'relative',
  [theme.breakpoints.down('md')]: {
    gap: theme.spacing(2),
  },
  [theme.breakpoints.down('sm')]: {
    gap: theme.spacing(1.5),
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
    top: -32,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 3,
    height: 32,
    background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.4)} 0%, ${alpha(theme.palette.primary.main, 0.6)} 100%)`,
    borderRadius: 2,
    zIndex: 1
  },
  
  // First child doesn't need the vertical line
  '&:first-of-type::before': {
    display: 'none'
  }
}));

const ConnectionLines = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: -16,
  left: '0%',
  right: '0%',
  height: 3,
  background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.4)} 0%, ${alpha(theme.palette.primary.main, 0.6)} 50%, ${alpha(theme.palette.primary.main, 0.4)} 100%)`,
  borderRadius: 2,
  zIndex: 0,
  
  // Center connection point
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -14,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 3,
    height: 16,
    background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.6)} 0%, ${alpha(theme.palette.primary.main, 0.4)} 100%)`,
    borderRadius: 2,
    zIndex: 1
  }
}));

const TreeNode = styled(Box)(({ theme, isRoot = false }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  position: 'relative',
  marginBottom: theme.spacing(3),
  minWidth: isRoot ? 320 : 280,
  maxWidth: isRoot ? 400 : 320,
  
  [theme.breakpoints.down('md')]: {
    minWidth: isRoot ? 280 : 240,
    maxWidth: isRoot ? 320 : 280,
  },
  
  [theme.breakpoints.down('sm')]: {
    minWidth: '100%',
    maxWidth: '100%',
  }
}));

const NodeCard = styled(Card)(({ theme, nodeType, isExpanded, isRoot = false }) => ({
  borderRadius: 16,
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
  boxShadow: isExpanded ? theme.shadows[6] : theme.shadows[2],
  width: '100%',
  minHeight: isRoot ? 120 : 100,
  
  '&:hover': {
    transform: 'translateY(-4px) scale(1.02)',
    boxShadow: theme.shadows[12],
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
      top: -2,
      left: -2,
      right: -2,
      bottom: -2,
      borderRadius: 18,
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
  gap: theme.spacing(1.5),
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(2),
  padding: theme.spacing(2),
  borderRadius: 12,
  backgroundColor: alpha(theme.palette.grey[100], 0.5),
  border: `1px dashed ${alpha(theme.palette.grey[400], 0.6)}`,
  
  [theme.breakpoints.down('sm')]: {
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
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

  const userId = localStorage.getItem('userId');

  useEffect(() => {
    fetchDataForActiveTab();
  }, [tabValue]);

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
    } catch (err) {
      console.error("Error fetching chart data:", err);
      setError("Failed to load organization data. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentHierarchy = async () => {
    const response = await axios.get(
      `/api/charts/department-hierarchy?user_id=${userId}`
    );
    setDepartmentData(response.data.departments || []);
    setSummary(response.data.summary || {});
  };

  const fetchRoleHierarchy = async () => {
    const response = await axios.get(
      `/api/charts/role-hierarchy?user_id=${userId}&include_users=true`
    );
    setRoleData(response.data.roles || []);
    setSummary(response.data.summary || {});
  };

  const fetchOrganizationStructure = async () => {
    const response = await axios.get(
      `/api/charts/organization-structure?user_id=${userId}`
    );
    setOrgStructure(response.data.organization || []);
    setSummary(response.data.summary || {});
  };

  const createSampleData = async () => {
    try {
      setLoading(true);
      const response = await axios.post(
        `/api/charts/create-sample-data?user_id=${userId}`
      );
      
      if (response.data.success) {
        console.log('Sample data created successfully:', response.data);
        await fetchDataForActiveTab();
      }
    } catch (err) {
      console.error('Error creating sample data:', err);
      setError('Failed to create sample data. You may need admin permissions.');
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
        minWidth: 200, 
        maxWidth: 240,
        mb: 1
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
                fontSize: '0.875rem'
              }}
            >
              {user.name ? user.name.charAt(0).toUpperCase() : <PersonOutlineIcon />}
            </Avatar>
            <Box flex={1} minWidth={0}>
              <Typography variant="body2" fontWeight="600" noWrap color="text.primary">
                {user.name || 'Unnamed User'}
              </Typography>
              {user.email && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {user.email}
                </Typography>
              )}
              {user.job_title && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
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
        <TreeNode isRoot={isRoot}>
          <NodeCard 
            nodeType="role" 
            isExpanded={isExpanded}
            isRoot={isRoot}
            onClick={() => hasChildren && toggleNodeExpand(role._id)}
            sx={{ cursor: hasChildren ? 'pointer' : 'default' }}
          >
            <CardContent sx={{ p: isRoot ? 3 : 2.5 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center" gap={1.5} flex={1} minWidth={0}>
                  <Avatar 
                    sx={{ 
                      bgcolor: theme.palette.primary.main, 
                      width: isRoot ? 48 : 40, 
                      height: isRoot ? 48 : 40 
                    }}
                  >
                    <RoleIcon fontSize={isRoot ? "medium" : "small"} />
                  </Avatar>
                  <Box flex={1} minWidth={0}>
                    <Typography 
                      variant={isRoot ? "h6" : "subtitle1"} 
                      fontWeight="700" 
                      noWrap
                    >
                      {role.name}
                    </Typography>
                    {role.description && (
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {role.description}
                      </Typography>
                    )}
                    {isRoot && (
                      <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                        Root Role
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  {users.length > 0 && (
                    <StyledChip 
                      chipType="users"
                      icon={<PersonOutlineIcon />}
                      label={users.length}
                      size="small"
                    />
                  )}
                  {subRoles.length > 0 && (
                    <StyledChip 
                      chipType="roles"
                      icon={<RoleIcon />}
                      label={subRoles.length}
                      size="small"
                    />
                  )}
                  {hasChildren && (
                    <IconButton size="small" sx={{ p: 0.5 }}>
                      {isExpanded ? <ArrowDownIcon /> : <ArrowRightIcon />}
                    </IconButton>
                  )}
                </Stack>
              </Box>
            </CardContent>
          </NodeCard>

          {/* Children */}
          <Collapse in={isExpanded}>
            <Box sx={{ mt: 4, width: '100%' }}>
              {/* Users */}
              {users.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography 
                    variant="subtitle2" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 2,
                      textAlign: 'center',
                      fontWeight: 600
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
                    variant="subtitle2" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 3,
                      textAlign: 'center',
                      fontWeight: 600
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
        </TreeNode>
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
            <CardContent sx={{ p: isRoot ? 3 : 2.5 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center" gap={2} flex={1} minWidth={0}>
                  <Avatar 
                    sx={{ 
                      bgcolor: theme.palette.warning.main, 
                      width: isRoot ? 56 : 48, 
                      height: isRoot ? 56 : 48 
                    }}
                  >
                    <DepartmentIcon fontSize={isRoot ? "large" : "medium"} />
                  </Avatar>
                  <Box flex={1} minWidth={0}>
                    <Typography 
                      variant={isRoot ? "h5" : "h6"} 
                      fontWeight="700" 
                      noWrap
                    >
                      {dept.name}
                    </Typography>
                    {dept.description && (
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {dept.description}
                      </Typography>
                    )}
                    <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
                      {isRoot ? 'Root Department' : 'Sub-Department'}
                    </Typography>
                  </Box>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  {dept.user_count > 0 && (
                    <StyledChip 
                      chipType="users"
                      icon={<PersonOutlineIcon />}
                      label={`${dept.user_count} Users`}
                      size="small"
                    />
                  )}
                  {dept.role_count > 0 && (
                    <StyledChip 
                      chipType="roles"
                      icon={<RoleIcon />}
                      label={`${dept.role_count} Roles`}
                      size="small"
                    />
                  )}
                  {subDepartments.length > 0 && (
                    <StyledChip 
                      chipType="departments"
                      icon={<DepartmentIcon />}
                      label={`${subDepartments.length} Sub-Dept`}
                      size="small"
                      sx={{
                        backgroundColor: alpha(theme.palette.warning.main, 0.1),
                        color: theme.palette.warning.main
                      }}
                    />
                  )}
                  {hasChildren && (
                    <IconButton size="small" sx={{ p: 0.5 }}>
                      {isExpanded ? <ArrowDownIcon /> : <ArrowRightIcon />}
                    </IconButton>
                  )}
                </Stack>
              </Box>
            </CardContent>
          </NodeCard>

          {/* Children */}
          <Collapse in={isExpanded}>
            <Box sx={{ mt: 4, width: '100%' }}>
              {/* Roles */}
              {roles.length > 0 && (
                <Box sx={{ mb: 4 }}>
                  <Typography 
                    variant="subtitle1" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 3,
                      textAlign: 'center',
                      fontWeight: 600
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
                    variant="subtitle1" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 3,
                      textAlign: 'center',
                      fontWeight: 600
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
    
    if (data.length === 0) {
      return (
        <Box 
          display="flex" 
          flexDirection="column" 
          alignItems="center" 
          justifyContent="center" 
          minHeight="400px"
          textAlign="center"
        >
          <DashboardIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No data available
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {tabValue === 0 ? 'No departments found. Create some sample data to get started.' : 
             tabValue === 1 ? 'No roles found. Create some sample data to get started.' : 
             'No organization structure found. Create some sample data to get started.'}
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button 
              variant="contained" 
              onClick={fetchDataForActiveTab}
              startIcon={<RefreshIcon />}
            >
              Refresh Data
            </Button>
            <Button 
              variant="outlined" 
              onClick={createSampleData}
              startIcon={<DashboardIcon />}
              color="warning"
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

  return (
    <OrganizationContainer maxWidth="xl">
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
      <Paper elevation={1} sx={{ borderRadius: 2, mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            variant={isMobile ? "fullWidth" : "standard"}
            centered={!isMobile}
            sx={{
              '& .MuiTab-root': {
                minHeight: 48,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.9rem'
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
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'error.light', color: 'error.contrastText' }}>
          <Typography variant="body1">{error}</Typography>
        </Paper>
      )}

      {/* Content */}
      <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: 3 }}>
          {loading ? (
            <Box 
              display="flex" 
              flexDirection="column" 
              alignItems="center" 
              justifyContent="center" 
              minHeight="400px"
            >
              <CircularProgress size={60} sx={{ mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Loading organization data...
              </Typography>
            </Box>
          ) : (
            <Box>
              {/* Toolbar */}
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" color="text.primary">
                  {tabValue === 0 ? 'Department Family Tree' :
                   tabValue === 1 ? 'Role Family Tree' :
                   'Complete Organization Family Tree'}
                </Typography>
                <Button 
                  variant="outlined" 
                  onClick={fetchDataForActiveTab}
                  startIcon={<RefreshIcon />}
                  size="small"
                >
                  Refresh
                </Button>
              </Box>

              {/* Chart Content */}
              {renderContent()}
            </Box>
          )}
        </Box>
      </Paper>
    </OrganizationContainer>
  );
};

export default ChartPage;
