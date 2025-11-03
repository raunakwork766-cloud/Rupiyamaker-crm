#!/bin/bash

# Auto-fix service stop script
echo "🛑 Stopping Auto-fix Service..."

# Check if PID file exists
if [ -f autofix-service.pid ]; then
    SERVICE_PID=$(cat autofix-service.pid)
    echo "📋 Found service PID: $SERVICE_PID"
    
    # Kill the process
    if kill $SERVICE_PID 2>/dev/null; then
        echo "✅ Service stopped successfully"
    else
        echo "⚠️ Service may already be stopped"
    fi
    
    # Remove PID file
    rm autofix-service.pid
else
    echo "📋 No PID file found, attempting to stop by port..."
    # Kill any process on port 3001
    lsof -ti:3001 | xargs kill -9 2>/dev/null && echo "✅ Service stopped" || echo "ℹ️ No service running on port 3001"
fi

echo "🏁 Auto-fix service stop complete"