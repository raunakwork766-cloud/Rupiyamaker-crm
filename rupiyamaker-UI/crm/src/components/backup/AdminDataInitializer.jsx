import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Box, 
  Typography, 
  Button,
  Alert,
  Container,
  Paper,
  Grid,
  Card,
  CardContent,
  LinearProgress
} from '@mui/material';
import { 
  Add as AddIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';

const AdminDataInitializer = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const userId = localStorage.getItem('userId');

  const createSampleData = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await axios.post(
        `/charts/create-sample-data`,
        {},
        { params: { user_id: userId } }
      );
      
      setResult(response.data);
    } catch (err) {
      console.error("Error creating sample data:", err);
      setError(err.response?.data?.detail || "Failed to create sample data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom align="center">
          Organization Data Initializer
        </Typography>
        
        <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
          Create sample organization data to test the charts functionality
        </Typography>

        {loading && (
          <Box sx={{ mb: 3 }}>
            <LinearProgress />
            <Typography variant="body2" align="center" sx={{ mt: 1 }}>
              Creating sample data...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {result && (
          <Alert 
            severity="success" 
            icon={<CheckIcon />}
            sx={{ mb: 3 }}
          >
            <Typography variant="subtitle1" gutterBottom>
              Sample data created successfully!
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={4}>
                <Card variant="outlined" sx={{ textAlign: 'center' }}>
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {result.summary?.departments_created || 0}
                    </Typography>
                    <Typography variant="caption">
                      Departments
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={4}>
                <Card variant="outlined" sx={{ textAlign: 'center' }}>
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {result.summary?.roles_created || 0}
                    </Typography>
                    <Typography variant="caption">
                      Roles
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={4}>
                <Card variant="outlined" sx={{ textAlign: 'center' }}>
                  <CardContent>
                    <Typography variant="h6" color="primary">
                      {result.summary?.users_created || 0}
                    </Typography>
                    <Typography variant="caption">
                      Users
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Alert>
        )}

        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={createSampleData}
            disabled={loading}
            sx={{ mr: 2 }}
          >
            Create Sample Data
          </Button>
          
          <Button
            variant="outlined"
            size="large"
            startIcon={<RefreshIcon />}
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default AdminDataInitializer;
