#!/bin/bash

# Quick Frontend Starter
echo "🚀 Starting RupiyaMaker Frontend..."

cd /www/wwwroot/rupiyamaker/RupiyaMe/rupiyamaker-UI/crm

# Kill any existing processes on the ports
pkill -f "vite.*4521" 2>/dev/null || true
pkill -f "vite.*4522" 2>/dev/null || true

# Wait a moment for cleanup
sleep 2

# Start the development server
echo "📡 Starting Vite development server..."
npm run dev &

# Wait for server to start
echo "⏳ Waiting for server to initialize..."
sleep 5

# Check if server started successfully
if netstat -tlnp | grep -q ":452[12]"; then
    PORT=$(netstat -tlnp | grep ":452[12]" | head -1 | awk '{print $4}' | cut -d: -f2)
    echo "✅ Frontend server started successfully!"
    echo "🌐 Frontend URL: http://localhost:$PORT"
    echo "🌐 Network URL: http://$(hostname -I | awk '{print $1}'):$PORT"
    echo ""
    echo "📋 To manage the frontend:"
    echo "   - View logs: tail -f /www/wwwroot/rupiyamaker/RupiyaMe/logs/frontend-*.log"
    echo "   - Stop: pkill -f vite"
    echo "   - Restart: /www/wwwroot/rupiyamaker/RupiyaMe/manage-frontend.sh restart"
else
    echo "❌ Failed to start frontend server"
    echo "📋 Check logs for details"
fi