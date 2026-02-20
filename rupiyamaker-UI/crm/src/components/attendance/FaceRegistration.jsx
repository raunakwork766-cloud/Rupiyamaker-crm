import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as faceapi from '@vladmandic/face-api';

const FaceRegistration = () => {
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [capturedSamples, setCapturedSamples] = useState([]);
  const [registrationStatus, setRegistrationStatus] = useState(null);
  const [modelsError, setModelsError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [faceStatus, setFaceStatus] = useState({});
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Load user from localStorage
  useEffect(() => {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    }
  }, []);

  // Load face-api.js models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models'; // You'll need to add face-api models to public/models
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
        console.log('Face-API models loaded successfully');
      } catch (error) {
        console.error('Error loading face-api models:', error);
        setModelsError(true);
        setModelsLoaded(false);
      }
    };

    loadModels();
  }, []);

  // Load employees list
  useEffect(() => {
    if (user?._id) {
      loadEmployees();
    }
  }, [user]);

  const loadEmployees = async () => {
    if (!user?._id) return;
    
    try {
      setLoading(true);
      const response = await axios.get(`/api/users/?user_id=${user._id}`);
      // API returns array directly
      const empList = Array.isArray(response.data) ? response.data : (response.data.users || response.data.data || []);
      setEmployees(empList);
      
      // Load face registration status for each employee (limit to first 20 to avoid too many calls)
      const statusPromises = empList.slice(0, 20).map(emp =>
        axios.get(`/api/attendance/face/${emp._id}?user_id=${user._id}`)
          .then(res => ({ [emp._id]: res.data }))
          .catch(() => ({ [emp._id]: { face_registered: false } }))
      );
      
      const statuses = await Promise.all(statusPromises);
      const statusMap = statuses.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      setFaceStatus(statusMap);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: 'user'
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCapturing(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Failed to access camera. Please grant camera permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCapturing(false);
  };

  const captureFaceSample = async () => {
    if (!videoRef.current) {
      alert('Camera not ready');
      return;
    }

    try {
      // Capture frame as base64 image
      const canvas2 = document.createElement('canvas');
      canvas2.width = videoRef.current.videoWidth || 640;
      canvas2.height = videoRef.current.videoHeight || 480;
      canvas2.getContext('2d').drawImage(videoRef.current, 0, 0);
      const photoData = canvas2.toDataURL('image/jpeg', 0.8);

      let descriptor = [];
      let detectionScore = 1.0;

      // Try face detection if models are loaded
      if (modelsLoaded) {
        try {
          const detection = await faceapi
            .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (!detection) {
            alert('No face detected. Please ensure your face is clearly visible.');
            return;
          }

          // Draw detection box on canvas
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const box = detection.detection.box;
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
          }

          descriptor = Array.from(detection.descriptor);
          detectionScore = detection.detection.score;
        } catch (faceError) {
          console.warn('Face detection failed, using raw capture:', faceError);
        }
      }

      const sample = {
        descriptor,
        detection_score: detectionScore,
        photoData,
        timestamp: new Date().toISOString()
      };

      setCapturedSamples(prev => {
        const newSamples = [...prev, sample];
        return newSamples;
      });
      
    } catch (error) {
      console.error('Error capturing face:', error);
      alert('Failed to capture sample. Please try again.');
    }
  };

  const registerFace = async () => {
    if (capturedSamples.length < 3) {
      alert('Please capture at least 3 face samples for accurate registration');
      return;
    }

    if (!selectedEmployee) {
      alert('Please select an employee');
      return;
    }

    try {
      setLoading(true);
      setRegistrationStatus('Registering face...');

      const registrationData = {
        employee_id: selectedEmployee._id,
        face_descriptors: capturedSamples.map(s => ({
          descriptor: s.descriptor,
          detection_score: s.detection_score
        })),
        photo_data: capturedSamples[0].photoData // Use first sample as reference photo
      };

      const response = await axios.post(
        `/api/attendance/face/register?admin_user_id=${user._id}`,
        registrationData
      );

      if (response.data.success) {
        setRegistrationStatus(`✅ Face registered successfully with ${response.data.samples_count} samples!`);
        
        // Update face status
        setFaceStatus(prev => ({
          ...prev,
          [selectedEmployee._id]: {
            face_registered: true,
            samples_count: response.data.samples_count,
            registered_at: response.data.registered_at
          }
        }));

        // Reset
        setTimeout(() => {
          setCapturedSamples([]);
          stopCamera();
          setRegistrationStatus(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Error registering face:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to register face';
      setRegistrationStatus(`❌ ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteFaceRegistration = async (employeeId) => {
    if (!window.confirm('Are you sure you want to delete this face registration?')) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(
        `/api/attendance/face/${employeeId}?admin_user_id=${user._id}`
      );
      
      alert('Face registration deleted successfully');
      
      // Update status
      setFaceStatus(prev => ({
        ...prev,
        [employeeId]: { face_registered: false }
      }));
    } catch (error) {
      console.error('Error deleting face:', error);
      alert('Failed to delete face registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="face-registration-container p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          👤 Facial Recognition Management
        </h2>
        <p className="text-gray-600 mt-2">
          Register employee faces for automated attendance verification
        </p>
      </div>

      {/* Models Status */}
      {!modelsLoaded && !modelsError && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
          <p className="text-yellow-700">⏳ Loading face recognition models...</p>
        </div>
      )}
      {modelsError && (
        <div className="bg-orange-100 border-l-4 border-orange-500 p-4 mb-4">
          <p className="text-orange-700">⚠️ Face detection models unavailable - basic camera capture will still work. Face auto-detection disabled.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold mb-3">Select Employee</h3>
          <input
            type="text"
            placeholder="🔍 Search employee..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3 focus:outline-none focus:border-purple-400"
          />
          {loading ? (
            <p className="text-gray-400 text-center py-8">⏳ Loading employees...</p>
          ) : employees.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No employees found</p>
          ) : (
          <div className="space-y-2 max-h-[540px] overflow-y-auto">
            {employees
              .filter(emp => {
                const name = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
                const email = (emp.email || '').toLowerCase();
                const code = (emp.emp_id || emp.employee_id || emp.code || '').toLowerCase();
                const q = searchQuery.toLowerCase();
                return !q || name.includes(q) || email.includes(q) || code.includes(q);
              })
              .map(employee => (
              <div
                key={employee._id}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedEmployee?._id === employee._id
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
                onClick={() => setSelectedEmployee(employee)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-800">{employee.first_name} {employee.last_name}</p>
                    <p className="text-sm text-gray-500">{employee.email}</p>
                    <p className="text-xs text-gray-400">{employee.emp_id || employee.employee_id || employee.code || ''}</p>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    {faceStatus[employee._id]?.face_registered ? (
                      <span className="text-green-600 text-xs font-semibold bg-green-50 px-2 py-1 rounded">✓ Face</span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Camera & Capture */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold mb-4">Capture Face Samples</h3>
          
          {selectedEmployee ? (
            <>
              <div className="mb-4 p-3 bg-blue-50 rounded">
                <p className="font-medium">{selectedEmployee.first_name} {selectedEmployee.last_name}</p>
                <p className="text-sm text-gray-600">
                  {faceStatus[selectedEmployee._id]?.face_registered
                    ? `Current samples: ${faceStatus[selectedEmployee._id].samples_count}`
                    : 'No face registered yet'}
                </p>
              </div>

              {/* Video Preview */}
              <div className="relative mb-4">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full rounded-lg bg-black"
                  style={{ maxHeight: '360px' }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full"
                  style={{ maxHeight: '360px' }}
                />
              </div>

              {/* Camera Controls */}
              <div className="space-y-3">
                {!capturing ? (
                  <button
                    onClick={startCamera}
                    disabled={loading}
                    className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
                  >
                    📷 Start Camera
                  </button>
                ) : (
                  <>
                    <button
                      onClick={captureFaceSample}
                      disabled={loading}
                      className="w-full py-2 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300"
                    >
                      📸 Capture Sample ({capturedSamples.length}/5)
                    </button>
                    <button
                      onClick={stopCamera}
                      className="w-full py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      ⏹ Stop Camera
                    </button>
                  </>
                )}
              </div>

              {/* Instructions */}
              <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
                <p className="font-medium mb-2">📋 Instructions:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  <li>Start camera and ensure good lighting</li>
                  <li>Face should be clearly visible</li>
                  <li>Capture 3-5 samples from different angles</li>
                  <li>Click "Register Face" when done</li>
                </ul>
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-center py-8">
              ← Select an employee to begin
            </p>
          )}
        </div>

        {/* Captured Samples & Actions */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold mb-4">Captured Samples</h3>
          
          <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
            {capturedSamples.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No samples captured yet</p>
            ) : (
              capturedSamples.map((sample, index) => (
                <div key={index} className="border rounded-lg p-2">
                  <img
                    src={sample.photoData}
                    alt={`Sample ${index + 1}`}
                    className="w-full rounded mb-2"
                  />
                  <p className="text-xs text-gray-600">
                    Sample {index + 1} - Confidence: {(sample.detection_score * 100).toFixed(1)}%
                  </p>
                  <button
                    onClick={() => setCapturedSamples(prev => prev.filter((_, i) => i !== index))}
                    className="text-red-500 text-xs mt-1"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Action Buttons */}
          {capturedSamples.length >= 3 && (
            <button
              onClick={registerFace}
              disabled={loading || !selectedEmployee}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:bg-gray-300 font-semibold"
            >
              {loading ? '⏳ Registering...' : '✅ Register Face'}
            </button>
          )}

          {capturedSamples.length > 0 && capturedSamples.length < 3 && (
            <p className="text-yellow-600 text-sm text-center">
              ⚠️ {3 - capturedSamples.length} more sample(s) needed
            </p>
          )}

          {/* Registration Status */}
          {registrationStatus && (
            <div className={`mt-4 p-3 rounded-lg ${
              registrationStatus.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {registrationStatus}
            </div>
          )}

          {/* Delete Registration */}
          {selectedEmployee && faceStatus[selectedEmployee._id]?.face_registered && (
            <button
              onClick={() => deleteFaceRegistration(selectedEmployee._id)}
              disabled={loading}
              className="w-full mt-3 py-2 px-4 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:bg-gray-300"
            >
              🗑️ Delete Registration
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceRegistration;
