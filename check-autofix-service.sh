#!/bin/bash

# Auto-fix service health check
echo "🔍 Checking Auto-fix Service Status..."

# Check if service is running on port 3001
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Service is running on port 3001"
    
    # Test the endpoint
    echo "🧪 Testing endpoint..."
    RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3001/fix-latest-status)
    HTTP_CODE="${RESPONSE: -3}"
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Endpoint responding correctly"
        echo "📊 Service is healthy and ready!"
    else
        echo "❌ Endpoint not responding correctly (HTTP: $HTTP_CODE)"
    fi
else
    echo "❌ Service is not running on port 3001"
    echo "💡 Run './start-autofix-service.sh' to start the service"
fi

# Check for PID file
if [ -f autofix-service.pid ]; then
    PID=$(cat autofix-service.pid)
    echo "📋 PID file exists: $PID"
    
    if ps -p $PID > /dev/null; then
        echo "✅ Process is running"
    else
        echo "⚠️ PID file exists but process is not running"
        echo "🔧 Consider running './start-autofix-service.sh' to restart"
    fi
else
    echo "📋 No PID file found"
fi