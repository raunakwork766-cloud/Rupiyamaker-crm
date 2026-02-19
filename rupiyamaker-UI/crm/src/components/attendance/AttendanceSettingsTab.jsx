import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  TextField,
  Grid,
  Typography,
  Box,
  Switch,
  FormControlLabel,
  FormGroup,
  Checkbox,
  Divider,
  Alert,
  Snackbar,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  Save as SaveIcon,
  Settings as SettingsIcon,
  RestoreFromTrash as ResetIcon,
  AccessTime as TimeIcon,
  LocationOn as LocationIcon,
  Camera as CameraIcon,
} from '@mui/icons-material';
import axios from 'axios';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use API proxy

const AttendanceSettingsTab = ({ userId }) => {
  const [settings, setSettings] = useState({
    // Shift Timing Settings (New)
    shift_start_time: '10:00',
    shift_end_time: '19:00', // 7:00 PM
    reporting_deadline: '10:15',
    
    // Working Hours Settings (Enhanced)
    full_day_working_hours: 9.0,
    half_day_minimum_working_hours: 5.0,
    
    // Grace Period Settings (New)
    grace_period_minutes: 30,
    grace_usage_limit: 2, // per month
    
    // Leave & Absconding Rules (New)
    pending_leave_auto_convert_days: 3, // Convert to absconding after 3 days
    absconding_penalty: -1, // Count as -1 day
    
    // Sunday & Sandwich Rules (New)
    enable_sunday_sandwich_rule: true,
    minimum_working_days_for_sunday: 5, // If less than 5 days worked, Sunday = 0
    
    // Original Settings (Keeping for compatibility)
    check_in_time: '09:30',
    check_out_time: '18:30',
    total_working_hours: 9.0,
    late_arrival_threshold: '10:30',
    early_departure_threshold: '17:30',
    minimum_working_hours_full_day: 8.0,
    minimum_working_hours_half_day: 4.0,
    overtime_threshold: 9.0,
    weekend_days: [5, 6], // Saturday, Sunday
    allow_early_check_in: true,
    allow_late_check_out: true,
    require_photo: true,
    require_geolocation: true,
    geofence_enabled: false,
    office_latitude: null,
    office_longitude: null,
    geofence_radius: 100.0,
  });

  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState({});

  const API_BASE_URL = '/api'; // Always use proxy

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${BASE_URL}/settings/attendance-settings`, {
        params: { user_id: userId }
      });
      
      if (response.data.success) {
        const settingsData = response.data.data;
        setSettings(settingsData);
        setOriginalSettings(settingsData);
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Error loading attendance settings:', error);
      setError('Failed to load attendance settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (field, value) => {
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    
    // Check if there are changes
    const hasChanges = JSON.stringify(newSettings) !== JSON.stringify(originalSettings);
    setHasChanges(hasChanges);
  };

  const handleTimeChange = (field, timeString) => {
    handleSettingChange(field, timeString);
  };

  const saveSettings = async () => {
    setSaveLoading(true);
    setError(null);
    
    try {
      // Prepare update data (only changed fields)
      const updateData = {};
      Object.keys(settings).forEach(key => {
        if (settings[key] !== originalSettings[key]) {
          updateData[key] = settings[key];
        }
      });

      const response = await axios.put(`${BASE_URL}/settings/attendance-settings`, updateData, {
        params: { user_id: userId }
      });
      
      if (response.data.message) {
        setSuccess('Attendance settings updated successfully');
        setOriginalSettings(settings);
        setHasChanges(false);
        
        // Auto-hide success message
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (error) {
      console.error('Error saving attendance settings:', error);
      setError(error.response?.data?.detail || 'Failed to save attendance settings');
    } finally {
      setSaveLoading(false);
    }
  };

  const resetToDefaults = async () => {
    if (window.confirm('Are you sure you want to reset all attendance settings to default values?')) {
      setSaveLoading(true);
      setError(null);
      
      try {
        const response = await axios.post(`${BASE_URL}/settings/attendance-settings/reset`, {}, {
          params: { user_id: userId }
        });
        
        if (response.data.message) {
          setSuccess('Attendance settings reset to defaults');
          await loadSettings(); // Reload settings
          
          // Auto-hide success message
          setTimeout(() => setSuccess(null), 3000);
        }
      } catch (error) {
        console.error('Error resetting attendance settings:', error);
        setError(error.response?.data?.detail || 'Failed to reset attendance settings');
      } finally {
        setSaveLoading(false);
      }
    }
  };

  const handleWeekendDayChange = (day) => {
    setSettings(prev => ({
      ...prev,
      weekend_days: prev.weekend_days.includes(day)
        ? prev.weekend_days.filter(d => d !== day)
        : [...prev.weekend_days, day].sort()
    }));
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  };

  const weekDays = [
    { value: 0, label: 'Monday' },
    { value: 1, label: 'Tuesday' },
    { value: 2, label: 'Wednesday' },
    { value: 3, label: 'Thursday' },
    { value: 4, label: 'Friday' },
    { value: 5, label: 'Saturday' },
    { value: 6, label: 'Sunday' }
  ];

  if (loading) {
    return (
      <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading attendance settings...</Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
        {/* Header */}
        <Card elevation={2} sx={{ mb: 3 }}>
          <CardHeader
            avatar={<SettingsIcon />}
            title="Attendance Settings"
            subheader="Configure attendance system parameters and rules"
            action={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<ResetIcon />}
                  onClick={resetToDefaults}
                  disabled={saveLoading}
                >
                  Reset to Defaults
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={saveSettings}
                  disabled={!hasChanges || saveLoading}
                  loading={saveLoading}
                >
                  {saveLoading ? 'Saving...' : 'Save Settings'}
                </Button>
              </Box>
            }
          />
        </Card>

        <Grid container spacing={3}>
          {/* === NEW: Shift Timing Settings === */}
          <Grid item xs={12}>
            <Card elevation={2} sx={{ bgcolor: '#f8f9fa', border: '2px solid #2196f3' }}>
              <CardHeader
                avatar={<TimeIcon sx={{ color: '#2196f3' }} />}
                title="Shift Timing Settings (Primary)"
                subheader="⚠️ Main shift timing configuration - This overrides check-in/check-out times"
                titleTypographyProps={{ fontWeight: 'bold' }}
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Shift Start Time"
                      type="time"
                      value={formatTime(settings.shift_start_time)}
                      onChange={(e) => handleTimeChange('shift_start_time', e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      helperText="Official shift start (e.g., 10:00 AM)"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Shift End Time"
                      type="time"
                      value={formatTime(settings.shift_end_time)}
                      onChange={(e) => handleTimeChange('shift_end_time', e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      helperText="Official shift end (e.g., 7:00 PM)"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Reporting Deadline"
                      type="time"
                      value={formatTime(settings.reporting_deadline)}
                      onChange={(e) => handleTimeChange('reporting_deadline', e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      helperText="After this = Half Day (e.g., 10:15 AM)"
                      sx={{ '& .MuiInputBase-root': { bgcolor: '#fff3cd' } }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Alert severity="info">
                      <strong>Rule:</strong> Punch In before {formatTime(settings.reporting_deadline)} = Present | 
                      Punch In after {formatTime(settings.reporting_deadline)} = Half Day
                    </Alert>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* === NEW: Enhanced Working Hours Settings === */}
          <Grid item xs={12} md={6}>
            <Card elevation={2} sx={{ bgcolor: '#f1f8ff', border: '2px solid #0366d6' }}>
              <CardHeader
                title="Working Hours Settings (Main Calculation)"
                subheader="These hours determine final attendance status"
                titleTypographyProps={{ fontWeight: 'bold' }}
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      label="Full Day Working Hours"
                      type="number"
                      value={settings.full_day_working_hours}
                      onChange={(e) => handleSettingChange('full_day_working_hours', parseFloat(e.target.value))}
                      fullWidth
                      inputProps={{ min: 1, max: 24, step: 0.5 }}
                      helperText="Working ≥ 9 hrs = Full Day (Count = 1)"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Half Day Minimum Working Hours"
                      type="number"
                      value={settings.half_day_minimum_working_hours}
                      onChange={(e) => handleSettingChange('half_day_minimum_working_hours', parseFloat(e.target.value))}
                      fullWidth
                      inputProps={{ min: 1, max: 12, step: 0.5 }}
                      helperText="Working ≥ 5 hrs but < 9 = Half Day (Count = 0.5)"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Alert severity="warning">
                      <strong>Logic:</strong> <br/>
                      • ≥ {settings.full_day_working_hours} hrs = <strong>Full Day</strong> (1) <br/>
                      • ≥ {settings.half_day_minimum_working_hours} hrs but &lt; {settings.full_day_working_hours} = <strong>Half Day</strong> (0.5) <br/>
                      • &lt; {settings.half_day_minimum_working_hours} hrs = <strong>Zero</strong> (0)
                    </Alert>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* === NEW: Grace Period Settings === */}
          <Grid item xs={12} md={6}>
            <Card elevation={2} sx={{ bgcolor: '#fff8e1', border: '2px solid #ffc107' }}>
              <CardHeader
                title="Grace Period Configuration"
                subheader="Limited late coming without penalty"
                titleTypographyProps={{ fontWeight: 'bold' }}
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      label="Grace Period (Minutes)"
                      type="number"
                      value={settings.grace_period_minutes}
                      onChange={(e) => handleSettingChange('grace_period_minutes', parseInt(e.target.value))}
                      fullWidth
                      inputProps={{ min: 0, max: 60, step: 5 }}
                      helperText="E.g., 30 mins grace after deadline"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Grace Usage Limit (per month)"
                      type="number"
                      value={settings.grace_usage_limit}
                      onChange={(e) => handleSettingChange('grace_usage_limit', parseInt(e.target.value))}
                      fullWidth
                      inputProps={{ min: 0, max: 10, step: 1 }}
                      helperText="How many times grace can be used per month"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Alert severity="info">
                      <strong>Example:</strong> Reporting deadline 10:15, Grace 30 mins<br/>
                      • Punch In 10:40 with grace available = <strong>Present</strong><br/>
                      • Punch In 10:40 with grace exhausted = <strong>Half Day</strong>
                    </Alert>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* === NEW: Leave & Absconding Rules === */}
          <Grid item xs={12} md={6}>
            <Card elevation={2} sx={{ bgcolor: '#fff3f3', border: '2px solid #dc3545' }}>
              <CardHeader
                title="Leave & Absconding Rules"
                subheader="Auto-conversion and penalty settings"
                titleTypographyProps={{ fontWeight: 'bold' }}
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      label="Pending Leave Auto-Convert (Days)"
                      type="number"
                      value={settings.pending_leave_auto_convert_days}
                      onChange={(e) => handleSettingChange('pending_leave_auto_convert_days', parseInt(e.target.value))}
                      fullWidth
                      inputProps={{ min: 1, max: 7, step: 1 }}
                      helperText="Convert unapproved leave to Absconding after X days"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Absconding Penalty"
                      type="number"
                      value={settings.absconding_penalty}
                      onChange={(e) => handleSettingChange('absconding_penalty', parseInt(e.target.value))}
                      fullWidth
                      inputProps={{ min: -2, max: 0, step: 1 }}
                      helperText="Attendance count for absconding (negative value)"
                      disabled
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Alert severity="error">
                      <strong>Rule:</strong> <br/>
                      • Leave not approved for {settings.pending_leave_auto_convert_days} days = Auto Absconding (-1)<br/>
                      • Manager can still approve later to convert back to Leave
                    </Alert>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* === NEW: Sunday & Sandwich Rules === */}
          <Grid item xs={12} md={6}>
            <Card elevation={2} sx={{ bgcolor: '#f3e5f5', border: '2px solid #9c27b0' }}>
              <CardHeader
                title="Sunday & Sandwich Rules"
                subheader="Weekend penalty rules for absconding"
                titleTypographyProps={{ fontWeight: 'bold' }}
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.enable_sunday_sandwich_rule}
                          onChange={(e) => handleSettingChange('enable_sunday_sandwich_rule', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Enable Sunday Sandwich Rule"
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 4, mt: 1 }}>
                      Saturday/Monday absconding → Sunday automatically becomes Zero
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Minimum Working Days for Sunday"
                      type="number"
                      value={settings.minimum_working_days_for_sunday}
                      onChange={(e) => handleSettingChange('minimum_working_days_for_sunday', parseInt(e.target.value))}
                      fullWidth
                      inputProps={{ min: 3, max: 6, step: 1 }}
                      helperText="If worked days < this, Sunday = 0"
                      disabled={!settings.enable_sunday_sandwich_rule}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Alert severity="warning">
                      <strong>Rules:</strong> <br/>
                      • Saturday OR Monday absconding/unapproved = Sunday becomes <strong>Zero (0)</strong><br/>
                      • Working days &lt; {settings.minimum_working_days_for_sunday} in week = Sunday <strong>Zero (0)</strong><br/>
                      • Penalty applied only once per Sunday
                    </Alert>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Time Settings */}
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardHeader
                avatar={<TimeIcon />}
                title="Time Configuration"
                subheader="Set standard check-in and check-out times"
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      label="Check-in Time"
                      type="time"
                      value={formatTime(settings.check_in_time)}
                      onChange={(e) => handleTimeChange('check_in_time', e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Check-out Time"
                      type="time"
                      value={formatTime(settings.check_out_time)}
                      onChange={(e) => handleTimeChange('check_out_time', e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Late Arrival Threshold"
                      type="time"
                      value={formatTime(settings.late_arrival_threshold)}
                      onChange={(e) => handleTimeChange('late_arrival_threshold', e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      helperText="Check-in after this time = Half Day"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Early Departure Threshold"
                      type="time"
                      value={formatTime(settings.early_departure_threshold)}
                      onChange={(e) => handleTimeChange('early_departure_threshold', e.target.value)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      helperText="Check-out before this time = Half Day"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Working Hours Settings */}
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardHeader
                title="Working Hours Configuration"
                subheader="Define minimum hours for attendance status"
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      label="Total Working Hours"
                      type="number"
                      value={settings.total_working_hours}
                      onChange={(e) => handleSettingChange('total_working_hours', parseFloat(e.target.value))}
                      fullWidth
                      inputProps={{ min: 1, max: 24, step: 0.5 }}
                      helperText="Expected daily working hours"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Minimum Hours for Full Day"
                      type="number"
                      value={settings.minimum_working_hours_full_day}
                      onChange={(e) => handleSettingChange('minimum_working_hours_full_day', parseFloat(e.target.value))}
                      fullWidth
                      inputProps={{ min: 1, max: 24, step: 0.5 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Minimum Hours for Half Day"
                      type="number"
                      value={settings.minimum_working_hours_half_day}
                      onChange={(e) => handleSettingChange('minimum_working_hours_half_day', parseFloat(e.target.value))}
                      fullWidth
                      inputProps={{ min: 1, max: 12, step: 0.5 }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Overtime Threshold (hours)"
                      type="number"
                      value={settings.overtime_threshold}
                      onChange={(e) => handleSettingChange('overtime_threshold', parseFloat(e.target.value))}
                      fullWidth
                      inputProps={{ min: 1, max: 24, step: 0.5 }}
                      helperText="Hours after which overtime is calculated"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Weekend Configuration */}
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardHeader
                title="Weekend Configuration"
                subheader="Select days considered as weekends"
              />
              <CardContent>
                <FormGroup row>
                  {weekDays.map((day) => (
                    <FormControlLabel
                      key={day.value}
                      control={
                        <Checkbox
                          checked={settings.weekend_days.includes(day.value)}
                          onChange={() => handleWeekendDayChange(day.value)}
                          color="primary"
                        />
                      }
                      label={day.label}
                    />
                  ))}
                </FormGroup>
              </CardContent>
            </Card>
          </Grid>

          {/* Check-in/Check-out Permissions */}
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardHeader
                title="Check-in/Check-out Permissions"
                subheader="Control early and late check-in/out options"
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.allow_early_check_in}
                          onChange={(e) => handleSettingChange('allow_early_check_in', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Allow Early Check-in"
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                      Allow employees to check-in before scheduled time
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.allow_late_check_out}
                          onChange={(e) => handleSettingChange('allow_late_check_out', e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Allow Late Check-out"
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                      Allow employees to check-out after scheduled time
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Requirements & Security */}
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardHeader
                avatar={<CameraIcon />}
                title="Requirements & Security"
                subheader="Configure mandatory fields and validations"
              />
              <CardContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.require_photo}
                        onChange={(e) => handleSettingChange('require_photo', e.target.checked)}
                      />
                    }
                    label="Photo Required for Check-in/out"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.require_geolocation}
                        onChange={(e) => handleSettingChange('require_geolocation', e.target.checked)}
                      />
                    }
                    label="Geolocation Required"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.geofence_enabled}
                        onChange={(e) => handleSettingChange('geofence_enabled', e.target.checked)}
                      />
                    }
                    label="Enable Geofence Validation"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Geofence Settings */}
          <Grid item xs={12} md={6}>
            <Card elevation={2}>
              <CardHeader
                avatar={<LocationIcon />}
                title="Geofence Configuration"
                subheader="Set office location and allowed radius"
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      label="Office Latitude"
                      type="number"
                      value={settings.office_latitude || ''}
                      onChange={(e) => handleSettingChange('office_latitude', parseFloat(e.target.value) || null)}
                      fullWidth
                      inputProps={{ step: 'any' }}
                      disabled={!settings.geofence_enabled}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="Office Longitude"
                      type="number"
                      value={settings.office_longitude || ''}
                      onChange={(e) => handleSettingChange('office_longitude', parseFloat(e.target.value) || null)}
                      fullWidth
                      inputProps={{ step: 'any' }}
                      disabled={!settings.geofence_enabled}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Geofence Radius (meters)"
                      type="number"
                      value={settings.geofence_radius}
                      onChange={(e) => handleSettingChange('geofence_radius', parseFloat(e.target.value))}
                      fullWidth
                      inputProps={{ min: 10, max: 10000, step: 10 }}
                      disabled={!settings.geofence_enabled}
                      helperText="Allowed distance from office location"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

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
  );
};

export default AttendanceSettingsTab;
