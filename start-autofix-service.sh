#!/bin/bash

# Auto-fix service startup script
echo "🚀 Starting Auto-fix Service..."

# Kill any existing service on port 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Start the service in background
cd /home/ubuntu/RupiyaMe
nohup node autofix-service.js > autofix-service.log 2>&1 &

# Get the PID
SERVICE_PID=$!
echo "✅ Auto-fix service started with PID: $SERVICE_PID"
echo "📊 Service running on: http://localhost:3001"
echo "📋 Logs available at: autofix-service.log"

# Save PID for later stopping
echo $SERVICE_PID > autofix-service.pid