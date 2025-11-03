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
