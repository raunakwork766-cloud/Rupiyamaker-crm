import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  Box,
  Grid,
  Paper,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Edit as EditIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Today as TodayIcon,
  DateRange as DateRangeIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  CheckCircle as CheckInIcon,
  ExitToApp as CheckOutIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  Comment as CommentIcon,
  Save as SaveIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import axios from 'axios';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use API proxy

const AttendanceManagement = ({ userInfo, hasEditPermission }) => {
  // States
  const [attendanceData, setAttendanceData] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Filters
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Dialogs
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [editData, setEditData] = useState({});
  
  // Tabs
  const [activeTab, setActiveTab] = useState(0);

  const API_BASE_URL = '/api'; // Always use proxy

  // Load data on component mount
  useEffect(() => {
    loadDepartments();
    loadEmployees();
    loadAttendanceData();
  }, [selectedDate, selectedDepartment, selectedEmployee]);

  const loadDepartments = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/departments`, {
        params: { user_id: userInfo._id }
      });
      if (response.data.success) {
        setDepartments(response.data.departments);
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/users`, {
        params: { user_id: userInfo._id }
      });
      if (response.data.success) {
        setEmployees(response.data.users);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadAttendanceData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const params = {
        user_id: userInfo._id,
        date: dateStr
      };
      
      if (selectedDepartment) {
        params.department_id = selectedDepartment;
      }
      
      if (selectedEmployee) {
        params.employee_id = selectedEmployee;
      }

      const response = await axios.get(`${BASE_URL}/attendance`, { params });
      if (response.data.success) {
        setAttendanceData(response.data.attendance || []);
      }
    } catch (error) {
      console.error('Error loading attendance data:', error);
      setError('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const viewAttendanceDetail = async (userId, date) => {
    try {
      const response = await axios.get(`${BASE_URL}/attendance/detail/${userId}/${date}`, {
        params: { requester_id: userInfo._id }
      });
      
      if (response.data) {
        setSelectedAttendance(response.data);
        setShowDetailDialog(true);
      }
    } catch (error) {
      console.error('Error loading attendance detail:', error);
      setError('Failed to load attendance details');
    }
  };

  const openEditDialog = (attendance) => {
    setSelectedAttendance(attendance);
    setEditData({
      check_in_time: attendance.check_in_time || '',
      check_out_time: attendance.check_out_time || '',
      status: attendance.status || 1.0,
      comments: attendance.comments || '',
      admin_comments: ''
    });
    setShowEditDialog(true);
  };

  const saveAttendanceEdit = async () => {
    if (!selectedAttendance) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.put(
        `${BASE_URL}/attendance/edit/${selectedAttendance.id}`,
        editData,
        {
          params: { admin_id: userInfo._id }
        }
      );

      if (response.data.success) {
        setSuccess('Attendance updated successfully');
        setShowEditDialog(false);
        await loadAttendanceData();
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      setError(error.response?.data?.detail || 'Failed to update attendance');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 1.0: return 'success';
      case 0.5: return 'warning';
      case 0.0: return 'info';
      case -1.0: return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 1.0: return 'Full Day';
      case 0.5: return 'Half Day';
      case 0.0: return 'Leave';
      case -1.0: return 'Absent';
      default: return 'Unknown';
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return 'N/A';
    return timeStr;
  };

  const filteredData = attendanceData.filter(item => {
    const matchesSearch = !searchQuery || 
      item.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.department_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const paginatedData = filteredData.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 2 }}>
        {/* Header */}
        <Card elevation={2} sx={{ mb: 3 }}>
          <CardHeader
            title="Attendance Management"
            subheader="View and manage employee attendance records"
            action={
              <Button
                startIcon={<DownloadIcon />}
                variant="outlined"
                onClick={() => {
                  // TODO: Implement export functionality
                  setSuccess('Export feature coming soon');
                }}
              >
                Export
              </Button>
            }
          />
        </Card>

        {/* Filters */}
        <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <DatePicker
                label="Select Date"
                value={selectedDate}
                onChange={(newValue) => setSelectedDate(newValue)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  label="Department"
                >
                  <MenuItem value="">All Departments</MenuItem>
                  {Array.isArray(departments) && departments.map((dept) => (
                    <MenuItem key={dept._id} value={dept._id}>
                      {dept.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Employee</InputLabel>
                <Select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  label="Employee"
                >
                  <MenuItem value="">Employees</MenuItem>
                  {employees.map((emp) => (
                    <MenuItem key={emp._id} value={emp._id}>
                      {emp.first_name} {emp.last_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
                }}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Attendance Table */}
        <Paper elevation={2}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Check-in</TableCell>
                  <TableCell>Check-out</TableCell>
                  <TableCell>Working Hours</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', py: 3 }}>
                      Loading attendance data...
                    </TableCell>
                  </TableRow>
                ) : paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', py: 3 }}>
                      No attendance records found for the selected date
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((attendance) => (
                    <TableRow key={attendance.id || attendance._id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            <PersonIcon />
                          </Avatar>
                          {attendance.employee_name}
                        </Box>
                      </TableCell>
                      <TableCell>{attendance.department_name || 'N/A'}</TableCell>
                      <TableCell>{formatTime(attendance.check_in_time)}</TableCell>
                      <TableCell>{formatTime(attendance.check_out_time)}</TableCell>
                      <TableCell>
                        {attendance.total_working_hours 
                          ? `${attendance.total_working_hours.toFixed(1)}h`
                          : 'N/A'
                        }
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusText(attendance.status)}
                          color={getStatusColor(attendance.status)}
                          size="small"
                        />
                        {attendance.is_late && (
                          <Chip
                            label="Late"
                            color="warning"
                            size="small"
                            sx={{ ml: 0.5 }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => viewAttendanceDetail(attendance.user_id, attendance.date)}
                          title="View Details"
                        >
                          <ViewIcon />
                        </IconButton>
                        {hasEditPermission && (
                          <IconButton
                            size="small"
                            onClick={() => openEditDialog(attendance)}
                            title="Edit Attendance"
                          >
                            <EditIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filteredData.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(event, newPage) => setPage(newPage)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
          />
        </Paper>

        {/* Detail Dialog */}
        <Dialog
          open={showDetailDialog}
          onClose={() => setShowDetailDialog(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Attendance Details - {selectedAttendance?.date_formatted}
            <IconButton
              onClick={() => setShowDetailDialog(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {selectedAttendance && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <List>
                    <ListItem>
                      <ListItemIcon><PersonIcon /></ListItemIcon>
                      <ListItemText
                        primary="Employee"
                        secondary={selectedAttendance.user_name}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckInIcon /></ListItemIcon>
                      <ListItemText
                        primary="Check-in Time"
                        secondary={selectedAttendance.check_in_time_formatted || 'Not checked in'}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckOutIcon /></ListItemIcon>
                      <ListItemText
                        primary="Check-out Time"
                        secondary={selectedAttendance.check_out_time_formatted || 'Not checked out'}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><TimeIcon /></ListItemIcon>
                      <ListItemText
                        primary="Total Working Hours"
                        secondary={selectedAttendance.total_working_hours_formatted}
                      />
                    </ListItem>
                  </List>
                </Grid>
                <Grid item xs={12} md={6}>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Status"
                        secondary={
                          <Chip
                            label={selectedAttendance.status_text}
                            color={getStatusColor(selectedAttendance.status)}
                            size="small"
                          />
                        }
                      />
                    </ListItem>
                    {selectedAttendance.check_in_geolocation && (
                      <ListItem>
                        <ListItemIcon><LocationIcon /></ListItemIcon>
                        <ListItemText
                          primary="Check-in Location"
                          secondary={selectedAttendance.check_in_geolocation.address || 'Location captured'}
                        />
                      </ListItem>
                    )}
                    {selectedAttendance.check_out_geolocation && (
                      <ListItem>
                        <ListItemIcon><LocationIcon /></ListItemIcon>
                        <ListItemText
                          primary="Check-out Location"
                          secondary={selectedAttendance.check_out_geolocation.address || 'Location captured'}
                        />
                      </ListItem>
                    )}
                    {selectedAttendance.comments && (
                      <ListItem>
                        <ListItemIcon><CommentIcon /></ListItemIcon>
                        <ListItemText
                          primary="Comments"
                          secondary={selectedAttendance.comments}
                        />
                      </ListItem>
                    )}
                    {selectedAttendance.admin_comments && (
                      <ListItem>
                        <ListItemText
                          primary="Admin Comments"
                          secondary={selectedAttendance.admin_comments}
                        />
                      </ListItem>
                    )}
                  </List>
                </Grid>
              </Grid>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Edit Attendance - {selectedAttendance?.user_name}
            <IconButton
              onClick={() => setShowEditDialog(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <TextField
                  label="Check-in Time"
                  type="time"
                  value={editData.check_in_time}
                  onChange={(e) => setEditData({ ...editData, check_in_time: e.target.value })}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Check-out Time"
                  type="time"
                  value={editData.check_out_time}
                  onChange={(e) => setEditData({ ...editData, check_out_time: e.target.value })}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={editData.status}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                    label="Status"
                  >
                    <MenuItem value={1.0}>Full Day</MenuItem>
                    <MenuItem value={0.5}>Half Day</MenuItem>
                    <MenuItem value={0.0}>Leave</MenuItem>
                    <MenuItem value={-1.0}>Absent</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Comments"
                  multiline
                  rows={2}
                  value={editData.comments}
                  onChange={(e) => setEditData({ ...editData, comments: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Admin Comments (Reason for Edit)"
                  multiline
                  rows={2}
                  value={editData.admin_comments}
                  onChange={(e) => setEditData({ ...editData, admin_comments: e.target.value })}
                  fullWidth
                  required
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={saveAttendanceEdit}
              disabled={loading || !editData.admin_comments}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Success/Error Messages */}
        <Snackbar
          open={!!success}
          autoHideDuration={6000}
          onClose={() => setSuccess(null)}
        >
          <Alert onClose={() => setSuccess(null)} severity="success">
            {success}
          </Alert>
        </Snackbar>

        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
        >
          <Alert onClose={() => setError(null)} severity="error">
            {error}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default AttendanceManagement;
