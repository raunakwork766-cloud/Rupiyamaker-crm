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

// Family Tree Specific Styles
const FamilyTreeContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 24,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: alpha(theme.palette.primary.main, 0.2),
    zIndex: 0
  }
}));

const TreeNode = styled(Box)(({ theme, level = 0 }) => ({
  marginLeft: theme.spacing(level * 4),
  position: 'relative',
  marginBottom: theme.spacing(2),
  '&::before': level > 0 ? {
    content: '""',
    position: 'absolute',
    left: -16,
    top: 24,
    width: 16,
    height: 2,
    backgroundColor: alpha(theme.palette.primary.main, 0.3),
    zIndex: 1
  } : {},
  '&::after': level > 0 ? {
    content: '""',
    position: 'absolute',
    left: -16,
    top: -8,
    width: 2,
    height: 32,
    backgroundColor: alpha(theme.palette.primary.main, 0.3),
    zIndex: 1
  } : {}
}));

const NodeCard = styled(Card)(({ theme, nodeType, isExpanded }) => ({
  borderRadius: 12,
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
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[8],
    borderColor: nodeType === 'department' ? theme.palette.warning.dark : 
                 nodeType === 'role' ? theme.palette.primary.dark : 
                 nodeType === 'user' ? theme.palette.success.dark :
                 theme.palette.grey[400],
  },
  zIndex: 2,
  position: 'relative'
}));

const UserGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: theme.spacing(1.5),
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    gridTemplateColumns: '1fr',
    gap: theme.spacing(1)
  }
}));

const ConnectionLine = styled(Box)(({ theme }) => ({
  position: 'absolute',
  left: -2,
  top: 48,
  width: 2,
  height: 'calc(100% - 48px)',
  backgroundColor: alpha(theme.palette.primary.main, 0.2),
  zIndex: 0
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

  // Family Tree Rendering Functions
  const renderFamilyTreeUser = (user) => (
    <NodeCard key={user._id} nodeType="user" isExpanded={false}>
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
              <Box display="flex" alignItems="center" gap={0.5} mt={0.25}>
                <EmailIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" noWrap>
                  {user.email}
                </Typography>
              </Box>
            )}
            {user.job_title && (
              <Box display="flex" alignItems="center" gap={0.5}>
                <JobIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" noWrap>
                  {user.job_title}
                </Typography>
              </Box>
            )}
          </Box>
          <Chip 
            label={user.status || 'Active'} 
            size="small" 
            color={user.status === 'active' ? 'success' : 'default'}
            sx={{ fontSize: '0.65rem', height: 18 }}
          />
        </Box>
      </CardContent>
    </NodeCard>
  );

  const renderFamilyTreeRole = (role, level = 1) => {
    const isExpanded = expandedNodes[role._id];
    const users = role.children?.filter(child => child.type === 'user') || [];
    const subRoles = role.children?.filter(child => child.type === 'role') || [];
    const hasChildren = users.length > 0 || subRoles.length > 0;

    return (
      <TreeNode key={role._id} level={level}>
        <NodeCard 
          nodeType="role" 
          isExpanded={isExpanded}
          onClick={() => hasChildren && toggleNodeExpand(role._id)}
          sx={{ cursor: hasChildren ? 'pointer' : 'default' }}
        >
          <CardContent sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center" gap={1.5} flex={1} minWidth={0}>
                <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 36, height: 36 }}>
                  <RoleIcon fontSize="small" />
                </Avatar>
                <Box flex={1} minWidth={0}>
                  <Typography variant="subtitle1" fontWeight="600" noWrap>
                    {role.name}
                  </Typography>
                  {role.description && (
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {role.description}
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

        <Collapse in={isExpanded}>
          <Box sx={{ mt: 2, position: 'relative' }}>
            {hasChildren && <ConnectionLine />}
            
            {/* Render Users in a grid */}
            {users.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ 
                    mb: 1.5, 
                    ml: 2,
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    fontWeight: 600
                  }}
                >
                  <GroupsIcon fontSize="small" />
                  Team Members ({users.length})
                </Typography>
                <UserGrid sx={{ ml: 2 }}>
                  {users.map(user => renderFamilyTreeUser(user))}
                </UserGrid>
              </Box>
            )}

            {/* Render Sub-roles */}
            {subRoles.map(subRole => renderFamilyTreeRole(subRole, level + 1))}
          </Box>
        </Collapse>
      </TreeNode>
    );
  };

  const renderFamilyTreeDepartment = (dept, level = 0) => {
    const isExpanded = expandedNodes[dept._id];
    const subDepartments = dept.children?.filter(child => child.type === 'department') || [];
    const roles = dept.children?.filter(child => child.type === 'role') || [];
    const hasChildren = subDepartments.length > 0 || roles.length > 0;

    return (
      <TreeNode key={dept._id} level={level}>
        <NodeCard 
          nodeType="department" 
          isExpanded={isExpanded}
          onClick={() => hasChildren && toggleNodeExpand(dept._id)}
          sx={{ cursor: hasChildren ? 'pointer' : 'default' }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center" gap={2} flex={1} minWidth={0}>
                <Avatar 
                  sx={{ 
                    bgcolor: theme.palette.warning.main, 
                    width: level === 0 ? 48 : 42, 
                    height: level === 0 ? 48 : 42 
                  }}
                >
                  <DepartmentIcon />
                </Avatar>
                <Box flex={1} minWidth={0}>
                  <Typography 
                    variant={level === 0 ? "h6" : "subtitle1"} 
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
                  {level === 0 && (
                    <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                      Root Department
                    </Typography>
                  )}
                  {level > 0 && (
                    <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
                      Sub-Department
                    </Typography>
                  )}
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

        <Collapse in={isExpanded}>
          <Box sx={{ mt: 3, position: 'relative' }}>
            {hasChildren && <ConnectionLine />}
            
            {/* Render Roles first */}
            {roles.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography 
                  variant="subtitle1" 
                  color="text.secondary" 
                  sx={{ 
                    mb: 2, 
                    ml: 2,
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    fontWeight: 600
                  }}
                >
                  <HierarchyIcon />
                  Department Roles ({roles.length})
                </Typography>
                {roles.map(role => renderFamilyTreeRole(role, 1))}
              </Box>
            )}

            {/* Render Sub-departments */}
            {subDepartments.length > 0 && (
              <Box>
                <Typography 
                  variant="subtitle1" 
                  color="text.secondary" 
                  sx={{ 
                    mb: 2, 
                    ml: 2,
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    fontWeight: 600
                  }}
                >
                  <DepartmentIcon />
                  Sub-Departments ({subDepartments.length})
                </Typography>
                {subDepartments.map(subDept => renderFamilyTreeDepartment(subDept, level + 1))}
              </Box>
            )}
          </Box>
        </Collapse>
      </TreeNode>
    );
  };

  // Render user card (for legacy tabs)
  const renderUserCard = (user, size = 'normal') => (
    <StyledCard 
      key={user._id} 
      cardType="user" 
      sx={{ 
        mb: 1, 
        maxWidth: size === 'compact' ? 280 : 320,
        minHeight: size === 'compact' ? 'auto' : 100
      }}
    >
      <CardContent sx={{ p: size === 'compact' ? 1.5 : 2, '&:last-child': { pb: size === 'compact' ? 1.5 : 2 } }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Avatar 
            sx={{ 
              bgcolor: theme.palette.primary.main, 
              width: size === 'compact' ? 32 : 40, 
              height: size === 'compact' ? 32 : 40,
              fontSize: size === 'compact' ? '0.875rem' : '1rem'
            }}
          >
            {user.name ? user.name.charAt(0).toUpperCase() : <PersonOutlineIcon />}
          </Avatar>
          <Box flex={1} minWidth={0}>
            <Typography 
              variant={size === 'compact' ? "body2" : "subtitle2"} 
              fontWeight="600" 
              noWrap
              color="text.primary"
            >
              {user.name || 'Unnamed User'}
            </Typography>
            {user.email && (
              <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" noWrap>
                  {user.email}
                </Typography>
              </Box>
            )}
            {user.job_title && (
              <Box display="flex" alignItems="center" gap={0.5} mt={0.25}>
                <JobIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" noWrap>
                  {user.job_title}
                </Typography>
              </Box>
            )}
          </Box>
          <Chip 
            label={user.status || 'Active'} 
            size="small" 
            color={user.status === 'active' ? 'success' : 'default'}
            sx={{ fontSize: '0.7rem', height: 20 }}
          />
        </Box>
      </CardContent>
    </StyledCard>
  );

  // Render role card with users (for legacy tabs)
  const renderRoleCard = (role, depth = 0) => {
    const isExpanded = expandedNodes[role._id];
    const hasChildren = role.children && role.children.length > 0;
    const users = role.children?.filter(child => child.type === 'user') || [];
    const subRoles = role.children?.filter(child => child.type === 'role') || [];

    return (
      <Box key={role._id} sx={{ ml: depth * 2, mb: 2 }}>
        <StyledCard 
          cardType="role" 
          className={isExpanded ? 'expanded' : ''}
          onClick={() => toggleNodeExpand(role._id)}
          sx={{ maxWidth: '100%' }}
        >
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center" gap={1.5} flex={1} minWidth={0}>
                <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 40, height: 40 }}>
                  <RoleIcon />
                </Avatar>
                <Box flex={1} minWidth={0}>
                  <Typography variant="h6" fontWeight="600" noWrap>
                    {role.name}
                  </Typography>
                  {role.description && (
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {role.description}
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
                  <IconButton size="small">
                    {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                  </IconButton>
                )}
              </Stack>
            </Box>
          </CardContent>
        </StyledCard>

        <Collapse in={isExpanded}>
          <Box sx={{ mt: 2, ml: 2 }}>
            {/* Render Users */}
            {users.length > 0 && (
              <Box mb={2}>
                <Typography variant="subtitle2" color="text.secondary" mb={1} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GroupsIcon fontSize="small" />
                  Team Members ({users.length})
                </Typography>
                <Grid container spacing={1}>
                  {users.map(user => (
                    <Grid item xs={12} sm={6} md={4} key={user._id}>
                      {renderUserCard(user, 'compact')}
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/* Render Sub-roles */}
            {subRoles.map(subRole => renderRoleCard(subRole, depth + 1))}
          </Box>
        </Collapse>
      </Box>
    );
  };

  // Render department card with roles and sub-departments (for legacy tabs)
  const renderDepartmentCard = (dept, depth = 0) => {
    const isExpanded = expandedNodes[dept._id];
    const hasChildren = dept.children && dept.children.length > 0;
    const subDepartments = dept.children?.filter(child => child.type === 'department') || [];
    const roles = dept.children?.filter(child => child.type === 'role') || [];

    return (
      <Box key={dept._id} sx={{ mb: 3 }}>
        <StyledCard 
          cardType="department" 
          className={isExpanded ? 'expanded' : ''}
          onClick={() => hasChildren && toggleNodeExpand(dept._id)}
          sx={{ 
            ml: depth * 2,
            cursor: hasChildren ? 'pointer' : 'default'
          }}
        >
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center" gap={1.5} flex={1} minWidth={0}>
                <Avatar sx={{ bgcolor: theme.palette.warning.main, width: 48, height: 48 }}>
                  <DepartmentIcon />
                </Avatar>
                <Box flex={1} minWidth={0}>
                  <Typography variant="h6" fontWeight="600" noWrap>
                    {dept.name}
                  </Typography>
                  {dept.description && (
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {dept.description}
                    </Typography>
                  )}
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
                {hasChildren && (
                  <IconButton size="small">
                    {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                  </IconButton>
                )}
              </Stack>
            </Box>
          </CardContent>
        </StyledCard>

        <Collapse in={isExpanded}>
          <Box sx={{ mt: 2, ml: 2 }}>
            {/* Render Sub-departments */}
            {subDepartments.map(subDept => renderDepartmentCard(subDept, depth + 1))}
            
            {/* Render Roles */}
            {roles.length > 0 && (
              <Box mt={2}>
                <Typography variant="subtitle1" color="text.secondary" mb={2} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HierarchyIcon />
                  Department Roles ({roles.length})
                </Typography>
                {roles.map(role => renderRoleCard(role, 0))}
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>
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

    if (tabValue === 0) {
      // Department hierarchy
      return data.map(dept => renderDepartmentCard(dept, 0));
    } else if (tabValue === 1) {
      // Role hierarchy
      return data.map(role => renderRoleCard(role, 0));
    } else {
      // Organization structure - Family Tree Style
      return (
        <FamilyTreeContainer>
          {data.map(node => renderFamilyTreeDepartment(node, 0))}
        </FamilyTreeContainer>
      );
    }
  };

  return (
    <OrganizationContainer maxWidth="xl">
      {/* Header */}
      <HeaderCard elevation={0}>
        <Grid container alignItems="center" justifyContent="space-between" spacing={2}>
          <Grid item xs={12} md={8}>
            <Typography variant={isMobile ? "h5" : "h4"} fontWeight="700" gutterBottom>
              Organization Chart
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Complete organizational hierarchy with departments, roles, and team members
            </Typography>
          </Grid>
          <Grid item xs={12} md={4} display="flex" justifyContent={isMobile ? "flex-start" : "flex-end"}>
            <Stack direction="row" spacing={2} alignItems="center">
              {summary.total_departments && (
                <Box textAlign="center">
                  <Typography variant="h6" fontWeight="600">{summary.total_departments}</Typography>
                  <Typography variant="caption">Departments</Typography>
                </Box>
              )}
              {summary.total_roles && (
                <Box textAlign="center">
                  <Typography variant="h6" fontWeight="600">{summary.total_roles}</Typography>
                  <Typography variant="caption">Roles</Typography>
                </Box>
              )}
              {summary.total_users && (
                <Box textAlign="center">
                  <Typography variant="h6" fontWeight="600">{summary.total_users}</Typography>
                  <Typography variant="caption">Users</Typography>
                </Box>
              )}
              {/* Fallback for legacy API responses */}
              {summary.departments_count && (
                <Box textAlign="center">
                  <Typography variant="h6" fontWeight="600">{summary.departments_count}</Typography>
                  <Typography variant="caption">Departments</Typography>
                </Box>
              )}
              {summary.roles_count && (
                <Box textAlign="center">
                  <Typography variant="h6" fontWeight="600">{summary.roles_count}</Typography>
                  <Typography variant="caption">Roles</Typography>
                </Box>
              )}
              {summary.users_count && (
                <Box textAlign="center">
                  <Typography variant="h6" fontWeight="600">{summary.users_count}</Typography>
                  <Typography variant="caption">Users</Typography>
                </Box>
              )}
            </Stack>
          </Grid>
        </Grid>
      </HeaderCard>

      {/* Navigation Tabs */}
      <Paper elevation={1} sx={{ mb: 3, borderRadius: 2 }}>
        <Box sx={{ p: 1 }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            variant={isMobile ? "fullWidth" : "standard"}
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
              label="Departments" 
              iconPosition="start"
            />
            <Tab 
              icon={<RoleIcon />} 
              label="Roles" 
              iconPosition="start"
            />
            <Tab 
              icon={<HierarchyIcon />} 
              label="Family Tree" 
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
                  {tabValue === 0 ? 'Department Hierarchy' :
                   tabValue === 1 ? 'Role Hierarchy' :
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
