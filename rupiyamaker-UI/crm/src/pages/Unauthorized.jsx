import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Button, Paper } from '@mui/material';
import { Lock, Home, ArrowBack } from 'lucide-react';

const Unauthorized = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 3
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={10}
          sx={{
            padding: 5,
            textAlign: 'center',
            borderRadius: 3,
            backgroundColor: 'white'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: 3
            }}
          >
            <Box
              sx={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'pulse 2s infinite'
              }}
            >
              <Lock size={60} color="white" />
            </Box>
          </Box>

          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 700,
              color: '#333',
              marginBottom: 2
            }}
          >
            403
          </Typography>

          <Typography
            variant="h5"
            component="h2"
            gutterBottom
            sx={{
              fontWeight: 600,
              color: '#555',
              marginBottom: 2
            }}
          >
            Access Denied
          </Typography>

          <Typography
            variant="body1"
            sx={{
              color: '#666',
              marginBottom: 4,
              lineHeight: 1.6
            }}
          >
            Sorry, you don't have permission to access this page. 
            This area is restricted to users with specific permissions.
            Please contact your administrator if you believe this is an error.
          </Typography>

          <Box
            sx={{
              display: 'flex',
              gap: 2,
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}
          >
            <Button
              variant="contained"
              startIcon={<ArrowBack size={20} />}
              onClick={handleGoBack}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                paddingX: 3,
                paddingY: 1.5,
                fontSize: '1rem',
                textTransform: 'none',
                borderRadius: 2,
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              Go Back
            </Button>

            <Button
              variant="outlined"
              startIcon={<Home size={20} />}
              onClick={handleGoHome}
              sx={{
                borderColor: '#667eea',
                color: '#667eea',
                paddingX: 3,
                paddingY: 1.5,
                fontSize: '1rem',
                textTransform: 'none',
                borderRadius: 2,
                borderWidth: 2,
                '&:hover': {
                  borderWidth: 2,
                  borderColor: '#5568d3',
                  backgroundColor: 'rgba(102, 126, 234, 0.05)',
                  transform: 'translateY(-2px)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              Go to Home
            </Button>
          </Box>

          <Box
            sx={{
              marginTop: 4,
              paddingTop: 3,
              borderTop: '1px solid #eee'
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: '#999',
                fontSize: '0.875rem'
              }}
            >
              If you believe you should have access to this page, please contact your system administrator.
            </Typography>
          </Box>
        </Paper>
      </Container>

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }
        `}
      </style>
    </Box>
  );
};

export default Unauthorized;
