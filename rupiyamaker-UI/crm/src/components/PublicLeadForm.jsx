import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { 
  Card, CardContent, CardHeader, Button, TextField, Grid, Box, Typography, 
  CircularProgress, Divider, FormControlLabel, Checkbox, FormControl, 
  InputLabel, Select, MenuItem, Alert, Paper, Container, styled 
} from '@mui/material';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Styled components for our sectioned layout
const SectionCard = styled(Paper)(({ theme }) => ({
  backgroundColor: '#fff',
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
  padding: theme.spacing(2),
  marginBottom: theme.spacing(3),
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '5px',
    height: '100%',
    backgroundColor: theme.palette.primary.main,
  }
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  marginBottom: theme.spacing(2),
  color: theme.palette.text.primary,
  display: 'flex',
  alignItems: 'center',
  '&:after': {
    content: '""',
    flex: 1,
    borderBottom: `1px solid ${theme.palette.divider}`,
    marginLeft: theme.spacing(1),
  }
}));

const PublicLeadForm = () => {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [leadData, setLeadData] = useState(null);
  const [expiryDate, setExpiryDate] = useState(null);
  const [updatedFields, setUpdatedFields] = useState({});
  const [formData, setFormData] = useState({
    // Basic information (required fields)
    first_name: '',
    last_name: '',
    phone: '',
    
    // Personal Information Section
    mother_name: '',
    marital_status: '',
    qualification: '',
    
    // Current Address Section
    current_address: '',
    current_address_type: '',
    current_address_proof: '',
    current_address_landmark: '',
    years_in_current_address: '',
    years_in_current_city: '',
    
    // Permanent Address Section
    permanent_address: '',
    permanent_address_landmark: '',
    
    // Employment Section
    company_name: '',
    designation: '',
    department: '',
    date_of_joining: '',
    current_work_experience: '',
    total_work_experience: '',
    
    // Contact Information Section
    personal_email: '',
    work_email: '',
    office_address: '',
    office_address_landmark: '',
    
    // References Section
    reference1_name: '',
    reference1_number: '',
    reference1_relation: '',
    reference1_address: '',
    
    reference2_name: '',
    reference2_number: '',
    reference2_relation: '',
    reference2_address: ''
  });
  const [isPermanentSameAsCurrent, setIsPermanentSameAsCurrent] = useState(false);

  // Extract share token from URL path
  const getShareToken = () => {
    const pathParts = location.pathname.split('/');
    const token = pathParts[pathParts.length - 1];
    console.log('Path parts:', pathParts);
    console.log('Extracted token:', token);
    return token;
  };

  const shareToken = getShareToken();
  // We can also use the params from useParams
  const { shareToken: paramToken } = params;
  console.log('Share token from params:', paramToken);
  console.log('Share token from path:', shareToken);

  useEffect(() => {
    const fetchLeadData = async () => {
      // Use token from URL params as it's more reliable
      const tokenToUse = params.shareToken || shareToken;
      
      if (!tokenToUse) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log(`Fetching data for token: ${tokenToUse}`);
        // Use the new share links API endpoint
        const response = await fetch(`/share-links/public/form/${tokenToUse}`);

        // Check if the response is OK
        if (!response.ok) {
          // Log the status and status text
          console.error(`Error status: ${response.status} - ${response.statusText}`);
          
          // Check for form sharing disabled (403 Forbidden)
          if (response.status === 403) {
            const errorData = await response.json().catch(() => ({ detail: 'Form access denied' }));
            if (errorData.detail && errorData.detail.includes('already been submitted')) {
              setError('This form has already been submitted and cannot be accessed again. Please contact support for assistance.');
              setLoading(false);
              return;
            }
          }
          
          // Try to read the response to see what we got
          const contentType = response.headers.get('content-type');
          console.log('Response content type:', contentType);
          
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to load lead data');
          } else {
            // For non-JSON responses (like HTML), read as text
            const textResponse = await response.text();
            console.error('Non-JSON response received:', textResponse.substring(0, 200) + '...');
            throw new Error('Received invalid response format. Please contact support.');
          }
        }
        
        // Check content type
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Unexpected content type:', contentType);
          throw new Error('Server returned an invalid response format');
        }
        
        const data = await response.json();
        setLeadData(data);

        // Populate form data with existing lead data
        // First, initialize with empty fields
        let initialFormData = {
          // Basic information
          first_name: '',
          last_name: '',
          phone: '',
          
          // Personal information
          mother_name: '',
          marital_status: '',
          qualification: '',
          
          // Current address
          current_address: '',
          current_address_type: '',
          current_address_proof: '',
          current_address_landmark: '',
          years_in_current_address: '',
          years_in_current_city: '',
          
          // Permanent address
          permanent_address: '',
          permanent_address_landmark: '',
          
          // Employment
          company_name: '',
          designation: '',
          department: '',
          date_of_joining: '',
          current_work_experience: '',
          total_work_experience: '',
          
          // Contact information
          personal_email: '',
          work_email: '',
          office_address: '',
          office_address_landmark: '',
          
          // References
          reference1_name: '',
          reference1_number: '',
          reference1_relation: '',
          reference1_address: '',
          
          reference2_name: '',
          reference2_number: '',
          reference2_relation: '',
          reference2_address: ''
        };
        
        // Check if dynamic_fields.login_form exists - this is our priority source
        if (data.dynamic_fields && data.dynamic_fields.login_form) {
          const loginForm = data.dynamic_fields.login_form;
          
          // First name and last name might be combined in customer_name
          if (loginForm.customer_name) {
            const nameParts = loginForm.customer_name.split(' ');
            if (nameParts.length > 1) {
              initialFormData.first_name = nameParts[0];
              initialFormData.last_name = nameParts.slice(1).join(' ');
            } else {
              initialFormData.first_name = loginForm.customer_name;
            }
          }
          
          // Contact informationv
          initialFormData.phone = loginForm.mobile_number || '';
          initialFormData.personal_email = loginForm.personal_email || loginForm.personal_mail || '';
          initialFormData.work_email = loginForm.work_email || loginForm.office_mail || '';
          
          // Personal information
          initialFormData.mother_name = loginForm.mother_name || '';
          initialFormData.marital_status = loginForm.marital_status || '';
          initialFormData.qualification = loginForm.qualification || '';
          
          // Current address
          initialFormData.current_address = loginForm.current_address || '';
          initialFormData.current_address_type = loginForm.current_address_type || '';
          initialFormData.current_address_proof = loginForm.current_address_proof_type || '';
          initialFormData.current_address_landmark = loginForm.current_landmark || '';
          initialFormData.years_in_current_address = loginForm.years_at_current_address || '';
          initialFormData.years_in_current_city = loginForm.years_in_current_city || '';
          
          // Permanent address
          initialFormData.permanent_address = loginForm.permanent_address || '';
          initialFormData.permanent_address_landmark = loginForm.permanent_landmark || '';
          
          // Employment
          initialFormData.company_name = loginForm.company_name || '';
          initialFormData.designation = loginForm.designation || '';
          initialFormData.department = loginForm.department || '';
          initialFormData.date_of_joining = loginForm.date_of_joining || '';
          initialFormData.current_work_experience = loginForm.current_work_experience || '';
          initialFormData.total_work_experience = loginForm.total_work_experience || '';
          initialFormData.office_address = loginForm.office_address || '';
          initialFormData.office_address_landmark = loginForm.office_landmark || '';
          
          // References - handle the array format
          if (loginForm.references && Array.isArray(loginForm.references) && loginForm.references.length > 0) {
            // Reference 1
            if (loginForm.references[0]) {
              initialFormData.reference1_name = loginForm.references[0].name || '';
              initialFormData.reference1_number = loginForm.references[0].mobile || '';
              initialFormData.reference1_relation = loginForm.references[0].relation || '';
              initialFormData.reference1_address = loginForm.references[0].address || '';
            }
            
            // Reference 2
            if (loginForm.references[1]) {
              initialFormData.reference2_name = loginForm.references[1].name || '';
              initialFormData.reference2_number = loginForm.references[1].mobile || '';
              initialFormData.reference2_relation = loginForm.references[1].relation || '';
              initialFormData.reference2_address = loginForm.references[1].address || '';
            }
          } else {
            // Legacy individual reference fields
            initialFormData.reference1_name = loginForm.reference1_name || '';
            initialFormData.reference1_number = loginForm.reference1_mobile_number || '';
            initialFormData.reference1_relation = loginForm.reference1_relation || '';
            initialFormData.reference1_address = loginForm.reference1_address || '';
            
            initialFormData.reference2_name = loginForm.reference2_name || '';
            initialFormData.reference2_number = loginForm.reference2_mobile_number || '';
            initialFormData.reference2_relation = loginForm.reference2_relation || '';
            initialFormData.reference2_address = loginForm.reference2_address || '';
          }
        }
        
        // Fall back to top-level fields if values are still empty
        if (!initialFormData.first_name) initialFormData.first_name = data.first_name || '';
        if (!initialFormData.last_name) initialFormData.last_name = data.last_name || '';
        if (!initialFormData.phone) initialFormData.phone = data.phone || '';
        
        // Check for other top-level fields that might be available
        if (!initialFormData.mother_name) initialFormData.mother_name = data.mother_name || '';
        if (!initialFormData.marital_status) initialFormData.marital_status = data.marital_status || '';
        if (!initialFormData.qualification) initialFormData.qualification = data.qualification || '';
        
        if (!initialFormData.current_address) initialFormData.current_address = data.current_address || '';
        if (!initialFormData.current_address_type) initialFormData.current_address_type = data.current_address_type || '';
        if (!initialFormData.current_address_proof) initialFormData.current_address_proof = data.current_address_proof || '';
        if (!initialFormData.current_address_landmark) initialFormData.current_address_landmark = data.current_address_landmark || '';
        if (!initialFormData.years_in_current_address) initialFormData.years_in_current_address = data.years_in_current_address || '';
        if (!initialFormData.years_in_current_city) initialFormData.years_in_current_city = data.years_in_current_city || '';
        
        // Also check in dynamic_fields.personal_details for additional information
        if (data.dynamic_fields && data.dynamic_fields.personal_details) {
          const personalDetails = data.dynamic_fields.personal_details;
          
          if (!initialFormData.company_name && personalDetails.company_name) {
            initialFormData.company_name = personalDetails.company_name;
          }
          
          if (!initialFormData.designation && personalDetails.occupation) {
            initialFormData.designation = personalDetails.occupation;
          }
          
          if (!initialFormData.total_work_experience && personalDetails.years_of_experience) {
            initialFormData.total_work_experience = personalDetails.years_of_experience;
          }
        }

        setFormData(initialFormData);

        // Check if permanent address is same as current address
        if (initialFormData.permanent_address && 
            initialFormData.current_address && 
            initialFormData.permanent_address === initialFormData.current_address) {
          setIsPermanentSameAsCurrent(true);
        }

        // Set expiry date for the link
        if (data.expires_at) {
          setExpiryDate(new Date(data.expires_at));
        }

      } catch (error) {
        console.error('Error fetching lead data:', error);
        setError(error.message || 'Failed to load lead data');
      } finally {
        setLoading(false);
      }
    };

    fetchLeadData();
  }, [shareToken]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    // Fields that should not be converted to uppercase (numeric, emails, phone numbers)
    const excludeFromUppercase = [
      'phone', 'alternate_mobile', 'personal_email', 'work_email',
      'current_work_experience', 'total_work_experience', 'pin_code',
      'reference1_number', 'reference2_number', 'dob', 'salary_amount',
      'loan_amount_required', 'monthly_salary'
    ];

    // Convert to uppercase if it's a text field
    const processedValue = excludeFromUppercase.includes(name) || typeof value !== 'string'
      ? value
      : value.toUpperCase();

    // All fields are now flat at the top level
    setFormData(prevData => ({
      ...prevData,
      [name]: processedValue
    }));
  };

  const handlePermanentAddressChange = (event) => {
    setIsPermanentSameAsCurrent(event.target.checked);
    
    if (event.target.checked) {
      // Copy current address to permanent address
      setFormData(prevData => ({
        ...prevData,
        permanent_address: prevData.current_address || '',
        permanent_address_landmark: prevData.current_address_landmark || ''
      }));
    }
  };

  useEffect(() => {
    // Update permanent address when current address changes and checkbox is checked
    if (isPermanentSameAsCurrent) {
      setFormData(prevData => ({
        ...prevData,
        permanent_address: prevData.current_address || '',
        permanent_address_landmark: prevData.current_address_landmark || ''
      }));
    }
  }, [isPermanentSameAsCurrent, formData.current_address, formData.current_address_landmark]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    try {
      setSubmitting(true);
      setError(null);
      
      // Structure the data according to the expected format in the backend
      // Priority is given to dynamic_fields.login_form fields
      const submitData = {
        // Basic lead fields at the top level
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        
        // Create the dynamic_fields structure with login_form
        dynamic_fields: {
          login_form: {
            // Personal information
            customer_name: `${formData.first_name} ${formData.last_name}`,
            mobile_number: formData.phone,
            alternate_mobile: formData.phone, // Using the same phone number as alternate
            personal_email: formData.personal_email,
            work_email: formData.work_email,
            mother_name: formData.mother_name,
            marital_status: formData.marital_status,
            qualification: formData.qualification,
            qualification_type: "Regular", // Adding default value
            date_of_birth: "",
            cibil_score: "",
            reference_name: "",
            product_type: "",
            
            // Current address
            current_address: formData.current_address,
            current_landmark: formData.current_address_landmark,
            current_address_type: formData.current_address_type,
            current_address_proof_type: formData.current_address_proof,
            years_at_current_address: formData.years_in_current_address,
            years_in_current_city: formData.years_in_current_city,
            
            // Permanent address
            permanent_address: formData.permanent_address,
            permanent_landmark: formData.permanent_address_landmark,
            
            // Employment
            company_name: formData.company_name,
            designation: formData.designation,
            department: formData.department,
            date_of_joining: formData.date_of_joining,
            current_work_experience: formData.current_work_experience,
            total_work_experience: formData.total_work_experience,
            office_address: formData.office_address,
            office_landmark: formData.office_address_landmark,
            
            // References - using the exact same structure from the sample JSON
            references: [
              {
                name: formData.reference1_name || '',
                mobile: formData.reference1_number || '',
                relation: formData.reference1_relation || '',
                address: formData.reference1_address || ''
              },
              {
                name: formData.reference2_name || '',
                mobile: formData.reference2_number || '',
                relation: formData.reference2_relation || '',
                address: formData.reference2_address || ''
              }
            ]
          }
        }
      };
      
      console.log(`Submitting form data for token: ${shareToken}`);
      
      const response = await fetch(`/share-links/public/form/${shareToken}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submitData)
      });

      // Check if the response is OK
      if (!response.ok) {
        // Log the status and status text
        console.error(`Error status: ${response.status} - ${response.statusText}`);
        
        // Try to read the response to see what we got
        const contentType = response.headers.get('content-type');
        console.log('Response content type on submit:', contentType);
        
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to update lead');
        } else {
          // For non-JSON responses (like HTML), read as text
          const textResponse = await response.text();
          console.error('Non-JSON response received on submit:', textResponse.substring(0, 200) + '...');
          throw new Error('Received invalid response format. Please contact support.');
        }
      }
      
      // Check content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Unexpected content type on submit:', contentType);
        throw new Error('Server returned an invalid response format');
      }
      
      // Success!
      const result = await response.json();
      setSuccess(true);
      toast.success('Information updated successfully!');
      
    } catch (error) {
      console.error('Error submitting form:', error);
      setError(error.message || 'Failed to update information');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
        <Typography ml={2}>Loading form data...</Typography>
      </Box>
    );
  }

  if (!leadData) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h5" color="error">Invalid or Expired Link</Typography>
          <Typography>The form link you are trying to access is invalid or has expired.</Typography>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Error: {error}
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card>
        <CardContent>
          <Box textAlign="center" py={4}>
            <Typography variant="h5" color="primary" gutterBottom>Thank You!</Typography>
            <Typography>Your information has been updated successfully.</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Check if the link is expired
  const isExpired = expiryDate && new Date() > expiryDate;
  
  if (isExpired) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h5" color="error">Link Expired</Typography>
          <Typography>This form link has expired and is no longer valid.</Typography>
        </CardContent>
      </Card>
    );
  }

  // We already check for leadData at the beginning, but just in case something changed
  if (!leadData) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h5" color="error">Error loading data</Typography>
          <Typography>An error occurred while loading the form data.</Typography>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Error: {error}
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      backgroundColor: '#121212', // Dark background
      pt: 4, 
      pb: 8 
    }}>
      <ToastContainer position="top-right" autoClose={5000} />
      <Container maxWidth="md">
        <Card sx={{ mb: 4, borderRadius: 2, overflow: 'hidden' }}>
          <CardHeader 
            title={leadData.form_title || "Update Your Information"} 
            subheader={`This form will help us process your application more efficiently.`}
            sx={{
              backgroundColor: 'primary.main',
              color: 'white',
              '& .MuiCardHeader-subheader': {
                color: 'rgba(255, 255, 255, 0.8)'
              }
            }}
          />
          <Divider />
          <CardContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                Error: {error}
              </Alert>
            )}
            
            {isExpired && (
              <Alert severity="error" sx={{ mb: 2 }}>
                This link has expired. Please contact support for assistance.
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              {/* Basic Information Section */}
              <SectionCard>
                <SectionTitle variant="h6">Basic Information</SectionTitle>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      label="First Name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      label="Last Name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone Number"
                      name="phone"
                      value={formData.phone || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                </Grid>
              </SectionCard>

              {/* Personal Information Section */}
              <SectionCard>
                <SectionTitle variant="h6">Personal Information</SectionTitle>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Mother's Name"
                      name="mother_name"
                      value={formData.mother_name || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Marital Status</InputLabel>
                      <Select
                        label="Marital Status"
                        name="marital_status"
                        value={formData.marital_status || ''}
                        onChange={handleInputChange}
                        disabled={isExpired}
                      >
                        <MenuItem value="">Select</MenuItem>
                        <MenuItem value="single">Single</MenuItem>
                        <MenuItem value="married">Married</MenuItem>
                        <MenuItem value="divorced">Divorced</MenuItem>
                        <MenuItem value="widowed">Widowed</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Qualification"
                      name="qualification"
                      value={formData.qualification || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                </Grid>
              </SectionCard>

              {/* Current Address Section */}
              <SectionCard>
                <SectionTitle variant="h6">Current Address</SectionTitle>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Current Address"
                      name="current_address"
                      value={formData.current_address || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Current Address Type</InputLabel>
                      <Select
                        label="Current Address Type"
                        name="current_address_type"
                        value={formData.current_address_type || ''}
                        onChange={handleInputChange}
                        disabled={isExpired}
                      >
                        <MenuItem value="">Select</MenuItem>
                        <MenuItem value="owned">Owned</MenuItem>
                        <MenuItem value="rented">Rented</MenuItem>
                        <MenuItem value="company_provided">Company Provided</MenuItem>
                        <MenuItem value="family_owned">Family Owned</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Current Address Proof"
                      name="current_address_proof"
                      value={formData.current_address_proof || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Landmark"
                      name="current_address_landmark"
                      value={formData.current_address_landmark || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Years at Current Address"
                      name="years_in_current_address"
                      value={formData.years_in_current_address || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Years in Current City"
                      name="years_in_current_city"
                      value={formData.years_in_current_city || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                </Grid>
              </SectionCard>

              {/* Permanent Address Section */}
              <SectionCard>
                <SectionTitle variant="h6">Permanent Address</SectionTitle>
                <Box mb={2}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isPermanentSameAsCurrent}
                        onChange={handlePermanentAddressChange}
                        disabled={isExpired}
                      />
                    }
                    label="Same as Current Address"
                  />
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Permanent Address"
                      name="permanent_address"
                      value={formData.permanent_address || ''}
                      onChange={handleInputChange}
                      disabled={isPermanentSameAsCurrent || isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Landmark"
                      name="permanent_address_landmark"
                      value={formData.permanent_address_landmark || ''}
                      onChange={handleInputChange}
                      disabled={isPermanentSameAsCurrent || isExpired}
                    />
                  </Grid>
                </Grid>
              </SectionCard>

              {/* Employment Details */}
              <SectionCard>
                <SectionTitle variant="h6">Employment Details</SectionTitle>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Company Name"
                      name="company_name"
                      value={formData.company_name || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Designation"
                      name="designation"
                      value={formData.designation || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Department"
                      name="department"
                      value={formData.department || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Date of Joining"
                      name="date_of_joining"
                      value={formData.date_of_joining || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Experience in Current Company (Years)"
                      name="current_work_experience"
                      value={formData.current_work_experience || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Total Work Experience (Years)"
                      name="total_work_experience"
                      value={formData.total_work_experience || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                </Grid>
              </SectionCard>

              {/* Contact Information */}
              <SectionCard>
                <SectionTitle variant="h6">Contact Information</SectionTitle>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Personal Email"
                      type="email"
                      name="personal_email"
                      value={formData.personal_email || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Work Email"
                      type="email"
                      name="work_email"
                      value={formData.work_email || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Office Address"
                      name="office_address"
                      value={formData.office_address || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Office Address Landmark"
                      name="office_address_landmark"
                      value={formData.office_address_landmark || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                </Grid>
              </SectionCard>

              {/* References */}
              <SectionCard>
                <SectionTitle variant="h6">Reference 1</SectionTitle>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Name"
                      name="reference1_name"
                      value={formData.reference1_name || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Mobile Number"
                      name="reference1_number"
                      value={formData.reference1_number || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Relation"
                      name="reference1_relation"
                      value={formData.reference1_relation || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Address"
                      name="reference1_address"
                      value={formData.reference1_address || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                </Grid>

                <Box mt={3}>
                  <SectionTitle variant="h6">Reference 2</SectionTitle>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Name"
                      name="reference2_name"
                      value={formData.reference2_name || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Mobile Number"
                      name="reference2_number"
                      value={formData.reference2_number || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Relation"
                      name="reference2_relation"
                      value={formData.reference2_relation || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Address"
                      name="reference2_address"
                      value={formData.reference2_address || ''}
                      onChange={handleInputChange}
                      disabled={isExpired}
                    />
                  </Grid>
                </Grid>
              </SectionCard>

              <Box mt={4} display="flex" justifyContent="center">
                <Button 
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={submitting || isExpired}
                  sx={{ minWidth: 200, py: 1.5, fontWeight: 'bold' }}
                >
                  {submitting ? <CircularProgress size={24} color="inherit" /> : 'Submit Information'}
                </Button>
              </Box>
            </form>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default PublicLeadForm;
