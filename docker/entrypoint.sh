#!/bin/bash

# Entrypoint script for Rupiyamaker CRM Docker container
# Starts both frontend (Vite dev server) and backend (Python FastAPI)
# Uses custom ports since 80/443 are already in use

set -e

# Setup NVM environment
export NVM_DIR="/root/.nvm"
export NODE_VERSION="20"
export PATH="$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH"

# Configuration
DOMAIN="crm.rupiyamakercrm.online"
HTTP_PORT="5902"
HTTPS_PORT="5903"
BACKEND_PORT="8049"
USE_EXISTING_SSL="true"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ENTRYPOINT] $1"
}

log "Starting Rupiyamaker CRM container initialization..."

# Create necessary directories
mkdir -p /var/log/rupiyamaker
mkdir -p /var/log/nginx
mkdir -p /app/media
mkdir -p /app/backend/media
mkdir -p /run/nginx

# Set proper permissions
chown -R www-data:www-data /var/log/nginx
chown -R www-data:www-data /app/media
chown -R www-data:www-data /app/backend/media

# Only set permissions for dist if it exists (production mode)
if [ -d "/app/frontend/dist" ]; then
    chown -R www-data:www-data /app/frontend/dist
    chmod -R 755 /app/frontend/dist
    log "Frontend dist directory permissions set"
else
    log "No dist directory found - running in development mode"
fi

log "Directory structure created and permissions set"

# Initialize SSL certificates - using existing certificates
if [ "$USE_EXISTING_SSL" = "true" ]; then
    log "Using existing SSL certificates for domain: $DOMAIN"
    
    # Check if SSL certificates exist
    if [ ! -f "/etc/ssl/certs/ssl.crt" ] || [ ! -f "/etc/ssl/private/ssl.key" ]; then
        log "ERROR: SSL certificates not found!"
        log "Expected: /etc/ssl/certs/ssl.crt and /etc/ssl/private/ssl.key"
        exit 1
    fi
    
    # Set proper SSL permissions (only if writable)
    if chmod 644 /etc/ssl/certs/ssl.crt 2>/dev/null; then
        chmod 600 /etc/ssl/private/ssl.key 2>/dev/null || true
        log "SSL certificates permissions updated"
    else
        log "SSL certificates are read-only (mounted from host) - skipping permission change"
    fi
    
    log "SSL certificates found and configured"
elif [ ! -z "$DOMAIN" ] && [ "$DOMAIN" != "localhost" ]; then
    log "Setting up SSL certificates for domain: $DOMAIN"
    
    # Run SSL setup in background to avoid blocking startup
    /usr/local/bin/ssl-renew.sh &
    SSL_PID=$!
    log "SSL certificate setup initiated (PID: $SSL_PID)"
else
    log "Using localhost configuration without SSL"
fi

# Start cron daemon for SSL renewal
log "Starting cron daemon for SSL auto-renewal..."
service cron start
log "Cron daemon started"

# Start frontend development server
log "🎨 Starting frontend development server on port $HTTP_PORT..."
cd /app/frontend

# Ensure node modules are available
if [ ! -d "node_modules" ]; then
    log "📦 Installing frontend dependencies..."
    . "$NVM_DIR/nvm.sh" && nvm use 20 && npm install
fi

# Start the development server in background
export NODE_ENV=development
export DOCKER=true
. "$NVM_DIR/nvm.sh" && nvm use 20 && npm run dev -- --host 0.0.0.0 --port $HTTP_PORT &
FRONTEND_PID=$!

log "Frontend development server started (PID: $FRONTEND_PID)"

# Wait a moment for frontend to start
sleep 5

# Check if frontend is running
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    log "ERROR: Frontend development server failed to start"
    exit 1
fi

# Start backend server
log "Starting backend server on port $BACKEND_PORT..."
cd /app/backend

# Export environment variables
export PYTHONPATH=/app/backend
export NODE_ENV=production

# Create symbolic links for SSL certificates so the backend can find them
if [ -f "/etc/ssl/certs/ssl.crt" ] && [ -f "/etc/ssl/private/ssl.key" ]; then
    ln -sf /etc/ssl/certs/ssl.crt /app/ssl.crt
    ln -sf /etc/ssl/private/ssl.key /app/ssl.key
    log "Created SSL certificate symbolic links for backend"
fi

# Start the backend using the Python module entry point
python3 -m app &
BACKEND_PID=$!

log "Backend server started (PID: $BACKEND_PID)"

# Wait for backend to be ready
log "Waiting for backend to be ready..."
for i in {1..30}; do
    if curl -f http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
        log "Backend health check passed"
        break
    fi
    
    if [ $i -eq 30 ]; then
        log "ERROR: Backend failed to start after 30 attempts"
        exit 1
    fi
    
    sleep 2
done

# Health check for frontend
log "Performing frontend health check..."
for i in {1..10}; do
    if curl -f http://localhost:$HTTP_PORT > /dev/null 2>&1; then
        log "Frontend health check passed"
        break
    fi
    
    if [ $i -eq 10 ]; then
        log "WARNING: Frontend health check failed"
    fi
    
    sleep 2
done

# Display startup information
log "==================================="
log "Rupiyamaker CRM is now running!"
log "==================================="
log "Frontend (DEV):   http://$DOMAIN:$HTTP_PORT"
log "Backend API:      https://$DOMAIN:$BACKEND_PORT"
log "Local Access:     http://localhost:$HTTP_PORT"
log "SSL Mode:         Using existing certificates"
log "Development Mode: Frontend running with npm run dev"
log "==================================="
log "Frontend PID:     $FRONTEND_PID"
log "Backend PID:      $BACKEND_PID"
log "==================================="

# Function to handle shutdown
shutdown() {
    log "Received shutdown signal, gracefully stopping services..."
    
    # Stop backend
    if kill -0 $BACKEND_PID 2>/dev/null; then
        log "Stopping backend server..."
        kill -TERM $BACKEND_PID
        wait $BACKEND_PID
    fi
    
    # Stop frontend
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        log "Stopping frontend development server..."
        kill -TERM $FRONTEND_PID
        wait $FRONTEND_PID
    fi
    
    # Stop cron
    log "Stopping cron daemon..."
    service cron stop
    
    log "All services stopped. Exiting."
    exit 0
}

# Set up signal handlers
trap shutdown SIGTERM SIGINT

# Monitor services
log "Monitoring services (use Ctrl+C to stop)..."
while true; do
    # Check if frontend is still running
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        log "ERROR: Frontend development server has stopped unexpectedly"
        exit 1
    fi
    
    # Check if backend is still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        log "ERROR: Backend has stopped unexpectedly"
        exit 1
    fi
    
    sleep 30
done
