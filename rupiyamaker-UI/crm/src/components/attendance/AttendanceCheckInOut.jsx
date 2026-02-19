import React, { useState, useEffect, useRef } from 'react';
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
  Typography,
  Box,
  Grid,
  Paper,
  Chip,
  Avatar,
  Alert,
  Snackbar,
  CircularProgress,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Camera as CameraIcon,
  CheckCircle as CheckInIcon,
  ExitToApp as CheckOutIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  PhotoCamera as PhotoIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import axios from 'axios';
import * as faceapi from '@vladmandic/face-api';

// API base URL - Use proxy in development
const API_BASE_URL = '/api'; // Always use API proxy

const AttendanceCheckInOut = ({ userId, userInfo }) => {
  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [faceVerificationResult, setFaceVerificationResult] = useState(null);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [photoData, setPhotoData] = useState(null);
  const [geolocation, setGeolocation] = useState(null);
  const [comments, setComments] = useState('');
  const [attendanceType, setAttendanceType] = useState(null); // 'check-in' or 'check-out'
  const [currentTime, setCurrentTime] = useState(new Date());
  const [attendanceDetail, setAttendanceDetail] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const API_BASE_URL = '/api'; // Always use proxy

  // Load face-api.js models
  useEffect(() => {
    const loadFaceModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
        console.log('Face recognition models loaded');
      } catch (error) {
        console.warn('Face recognition models not available:', error);
        // Non-blocking - attendance can work without face recognition
      }
    };

    loadFaceModels();
  }, []);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load current status on component mount
  useEffect(() => {
    if (userId) {
      loadCurrentStatus();
      loadTodayAttendance();
    }
  }, [userId]);

  const loadCurrentStatus = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/attendance/status/current/${userId}`);
      if (response.data.success) {
        setCurrentStatus(response.data);
      }
    } catch (error) {
      console.error('Error loading current status:', error);
    }
  };

  const loadTodayAttendance = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/attendance/today/${userId}`, {
        params: { requester_id: userId }
      });
      if (response.data.success) {
        setTodayAttendance(response.data);
      }
    } catch (error) {
      console.error('Error loading today attendance:', error);
    }
  };

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            address: `Lat: ${position.coords.latitude.toFixed(6)}, Lng: ${position.coords.longitude.toFixed(6)}`
          });
        },
        (error) => {
          reject(new Error(`Location error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: 640,
          height: 480 
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Failed to access camera. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setPhotoData(null);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0);
      
      const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      setPhotoData(base64Data);

      // Detect face and get descriptor if models are loaded
      if (modelsLoaded) {
        try {
          setLoading(true);
          const detection = await faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detection) {
            const descriptor = {
              descriptor: Array.from(detection.descriptor),
              detection_score: detection.detection.score
            };
            setFaceDescriptor(descriptor);
            setSuccess(`Face detected! Confidence: ${(detection.detection.score * 100).toFixed(1)}%`);
          } else {
            setFaceDescriptor(null);
            setError('No face detected. Photo captured without facial verification.');
          }
        } catch (error) {
          console.warn('Face detection failed:', error);
          setFaceDescriptor(null);
        } finally {
          setLoading(false);
        }
      }

      stopCamera();
    }
  };

  const handleCheckIn = async () => {
    if (!photoData) {
      setError('Photo is required for check-in');
      return;
    }

    setLoading(true);
    setError(null);
    setFaceVerificationResult(null);

    try {
      // Get current location
      const location = await getCurrentLocation();
      setGeolocation(location);

      const checkInData = {
        photo_data: photoData,
        geolocation: location,
        comments: comments,
        face_descriptor: faceDescriptor // Include face descriptor if available
      };

      const response = await axios.post(`${BASE_URL}/attendance/check-in`, checkInData, {
        params: { user_id: userId }
      });

      if (response.data.success) {
        setSuccess(response.data.message);
        
        // Show face verification result if available
        if (response.data.face_verification) {
          setFaceVerificationResult(response.data.face_verification);
          if (response.data.face_verification.verified) {
            setSuccess(`${response.data.message} ✓ Face verified (${(response.data.face_verification.confidence * 100).toFixed(1)}%)`);
          } else {
            setError(`Check-in successful but face verification failed (${(response.data.face_verification.confidence * 100).toFixed(1)}%)`);
          }
        }

        setPhotoData(null);
        setFaceDescriptor(null);
        setComments('');
        await loadCurrentStatus();
        await loadTodayAttendance();
      }
    } catch (error) {
      console.error('Error checking in:', error);
      setError(error.response?.data?.detail || 'Failed to check in');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!photoData) {
      setError('Photo is required for check-out');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get current location
      const location = await getCurrentLocation();
      setGeolocation(location);

      const checkOutData = {
        photo_data: photoData,
        geolocation: location,
        comments: comments
      };

      const response = await axios.post(`${BASE_URL}/attendance/check-out`, checkOutData, {
        params: { user_id: userId }
      });

      if (response.data.success) {
        setSuccess(response.data.message);
        setPhotoData(null);
        setComments('');
        await loadCurrentStatus();
        await loadTodayAttendance();
      }
    } catch (error) {
      console.error('Error checking out:', error);
      setError(error.response?.data?.detail || 'Failed to check out');
    } finally {
      setLoading(false);
    }
  };

  const viewAttendanceDetail = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await axios.get(`${BASE_URL}/attendance/detail/${userId}/${today}`, {
        params: { requester_id: userId }
      });
      
      if (response.data) {
        setAttendanceDetail(response.data);
        setShowDetailDialog(true);
      }
    } catch (error) {
      console.error('Error loading attendance detail:', error);
      setError('Failed to load attendance details');
    }
  };

  const formatTime = (dateTime) => {
    if (!dateTime) return '';
    return new Date(dateTime).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Full Day': return 'success';
      case 'Half Day': return 'warning';
      case 'Leave': return 'info';
      case 'Absent': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 2 }}>
      {/* Current Time Display */}
      <Paper elevation={2} sx={{ p: 2, mb: 3, textAlign: 'center', bgcolor: 'primary.dark', color: 'white' }}>
        <Typography variant="h4" component="div">
          {currentTime.toLocaleTimeString('en-IN', { hour12: false })}
        </Typography>
        <Typography variant="body1">
          {currentTime.toLocaleDateString('en-IN', { 
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
          })}
        </Typography>
      </Paper>

      {/* Current Status Card */}
      {currentStatus && (
        <Card elevation={2} sx={{ mb: 3 }}>
          <CardHeader
            avatar={<PersonIcon />}
            title={`${userInfo?.first_name || 'User'}'s Attendance Status`}
            subheader="Today's attendance information"
            action={
              <Button
                startIcon={<RefreshIcon />}
                onClick={() => {
                  loadCurrentStatus();
                  loadTodayAttendance();
                }}
                size="small"
              >
                Refresh
              </Button>
            }
          />
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CheckInIcon color={currentStatus.checked_in ? 'success' : 'disabled'} />
                  <Typography variant="body2">
                    Check-in: {currentStatus.check_in_time_formatted || 'Not checked in'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CheckOutIcon color={currentStatus.checked_out ? 'success' : 'disabled'} />
                  <Typography variant="body2">
                    Check-out: {currentStatus.check_out_time_formatted || 'Not checked out'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TimeIcon />
                  <Typography variant="body2">
                    Working Hours: {currentStatus.total_working_hours_formatted || '0 hours'}
                  </Typography>
                </Box>
                <Chip
                  label={currentStatus.current_status}
                  color={getStatusColor(currentStatus.status)}
                  size="small"
                />
                {currentStatus.is_late && (
                  <Chip
                    label="Late Arrival"
                    color="warning"
                    size="small"
                    sx={{ ml: 1 }}
                  />
                )}
                {currentStatus.is_early_departure && (
                  <Chip
                    label="Early Departure"
                    color="warning"
                    size="small"
                    sx={{ ml: 1 }}
                  />
                )}
              </Grid>
            </Grid>
            
            {todayAttendance?.has_attendance && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Button
                  startIcon={<ViewIcon />}
                  onClick={viewAttendanceDetail}
                  variant="outlined"
                  size="small"
                >
                  View Details
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            startIcon={<CheckInIcon />}
            onClick={() => {
              setAttendanceType('check-in');
              startCamera();
            }}
            disabled={loading || (currentStatus && currentStatus.checked_in)}
            sx={{ py: 2 }}
          >
            {loading && attendanceType === 'check-in' ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Check In'
            )}
          </Button>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Button
            variant="contained"
            color="secondary"
            fullWidth
            size="large"
            startIcon={<CheckOutIcon />}
            onClick={() => {
              setAttendanceType('check-out');
              startCamera();
            }}
            disabled={loading || !currentStatus?.checked_in || currentStatus?.checked_out}
            sx={{ py: 2 }}
          >
            {loading && attendanceType === 'check-out' ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Check Out'
            )}
          </Button>
        </Grid>
      </Grid>

      {/* Camera Dialog */}
      <Dialog
        open={showCamera || photoData}
        onClose={() => {
          stopCamera();
          setPhotoData(null);
          setAttendanceType(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {attendanceType === 'check-in' ? 'Check-In' : 'Check-Out'} - Capture Photo
          <IconButton
            onClick={() => {
              stopCamera();
              setPhotoData(null);
              setAttendanceType(null);
            }}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {showCamera && !photoData && (
            <Box sx={{ textAlign: 'center' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: '100%', maxWidth: 400, borderRadius: 8 }}
              />
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<PhotoIcon />}
                  onClick={capturePhoto}
                  size="large"
                >
                  Capture Photo
                </Button>
              </Box>
            </Box>
          )}
          
          {photoData && (
            <Box sx={{ textAlign: 'center' }}>
              <img
                src={`data:image/jpeg;base64,${photoData}`}
                alt="Captured"
                style={{ width: '100%', maxWidth: 400, borderRadius: 8 }}
              />
              <TextField
                label="Comments (Optional)"
                multiline
                rows={3}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                fullWidth
                sx={{ mt: 2 }}
              />
            </Box>
          )}
          
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </DialogContent>
        <DialogActions>
          {photoData && (
            <>
              <Button
                onClick={() => {
                  setPhotoData(null);
                  startCamera();
                }}
              >
                Retake Photo
              </Button>
              <Button
                variant="contained"
                onClick={attendanceType === 'check-in' ? handleCheckIn : handleCheckOut}
                disabled={loading}
              >
                {loading ? 'Processing...' : (attendanceType === 'check-in' ? 'Check In' : 'Check Out')}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Attendance Detail Dialog */}
      <Dialog
        open={showDetailDialog}
        onClose={() => setShowDetailDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Attendance Details - {attendanceDetail?.date_formatted}
          <IconButton
            onClick={() => setShowDetailDialog(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {attendanceDetail && (
            <List>
              <ListItem>
                <ListItemIcon><CheckInIcon /></ListItemIcon>
                <ListItemText
                  primary="Check-in Time"
                  secondary={attendanceDetail.check_in_time_formatted || 'Not checked in'}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><CheckOutIcon /></ListItemIcon>
                <ListItemText
                  primary="Check-out Time"
                  secondary={attendanceDetail.check_out_time_formatted || 'Not checked out'}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><TimeIcon /></ListItemIcon>
                <ListItemText
                  primary="Total Working Hours"
                  secondary={attendanceDetail.total_working_hours_formatted}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Status"
                  secondary={
                    <Chip
                      label={attendanceDetail.status_text}
                      color={getStatusColor(attendanceDetail.status_text)}
                      size="small"
                    />
                  }
                />
              </ListItem>
              {attendanceDetail.check_in_geolocation && (
                <ListItem>
                  <ListItemIcon><LocationIcon /></ListItemIcon>
                  <ListItemText
                    primary="Check-in Location"
                    secondary={attendanceDetail.check_in_geolocation.address || 'Location captured'}
                  />
                </ListItem>
              )}
              {attendanceDetail.comments && (
                <ListItem>
                  <ListItemText
                    primary="Comments"
                    secondary={attendanceDetail.comments}
                  />
                </ListItem>
              )}
            </List>
          )}
        </DialogContent>
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
  );
};

export default AttendanceCheckInOut;
