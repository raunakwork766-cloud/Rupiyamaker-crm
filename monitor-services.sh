#!/bin/bash
# Service Monitor Script - Auto-restart backend and frontend if down
# This script runs every 5 minutes to ensure services are always running

export PATH="/www/server/nodejs/v22.21.1/bin:$PATH"

LOG_FILE="/www/wwwroot/RupiyaMe/service-monitor.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Function to log messages
log_message() {
    echo "[$TIMESTAMP] $1" >> "$LOG_FILE"
}

# Check if PM2 is running
if ! command -v pm2 &> /dev/null; then
    log_message "ERROR: PM2 not found in PATH"
    exit 1
fi

# Get PM2 process list
PM2_LIST=$(pm2 jlist 2>/dev/null)

# Check backend status
BACKEND_STATUS=$(echo "$PM2_LIST" | grep '"name":"rupiyame-backend"' | grep -o '"status":"[^"]*"' | cut -d'"' -f4 | head -1)

if [ -z "$BACKEND_STATUS" ] || [ "$BACKEND_STATUS" != "online" ]; then
    log_message "WARNING: Backend is '$BACKEND_STATUS' - restarting..."
    pm2 restart rupiyame-backend 2>&1 >> "$LOG_FILE"
    log_message "Backend restarted"
else
    log_message "Backend is running normally"
fi

# Check frontend status
FRONTEND_STATUS=$(echo "$PM2_LIST" | grep '"name":"rupiyame-frontend"' | grep -o '"status":"[^"]*"' | cut -d'"' -f4 | head -1)

if [ -z "$FRONTEND_STATUS" ] || [ "$FRONTEND_STATUS" != "online" ]; then
    log_message "WARNING: Frontend is '$FRONTEND_STATUS' - restarting..."
    pm2 restart rupiyame-frontend 2>&1 >> "$LOG_FILE"
    log_message "Frontend restarted"
else
    log_message "Frontend is running normally"
fi

# If no processes found at all, start from ecosystem config
PROCESS_COUNT=$(echo "$PM2_LIST" | grep -c '"name"')
if [ "$PROCESS_COUNT" -eq 0 ]; then
    log_message "CRITICAL: No PM2 processes found - starting from ecosystem.config.js..."
    cd /www/wwwroot/RupiyaMe
    pm2 start ecosystem.config.js
    pm2 save --force
    log_message "Services started from ecosystem config"
fi
