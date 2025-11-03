#!/bin/bash

# RupiyaMaker CRM Native Deployment Script
# Alternative to Docker - runs directly on the server
# For live server deployment without Docker

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_message $BLUE "🚀 RupiyaMaker CRM Native Deployment"
print_message $BLUE "====================================="

# Configuration
FRONTEND_PORT=5902
BACKEND_PORT=8049
DOMAIN="crm.rupiyamakercrm.online"
PROJECT_DIR="/www/wwwroot/rupiyamaker/RupiyaMe"

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "rupiyamaker-UI" ]; then
    print_message $RED "❌ Please run this script from the RupiyaMe root directory"
    exit 1
fi

print_message $YELLOW "📋 Starting native deployment on live server..."
print_message $YELLOW "Frontend will run on port: $FRONTEND_PORT"
print_message $YELLOW "Backend will run on port: $BACKEND_PORT"
echo ""

# Check for Node.js
print_message $YELLOW "🔍 Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    print_message $RED "❌ Node.js is not installed. Installing Node.js 20..."
    
    # Install Node.js using NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    print_message $GREEN "✅ Node.js installed successfully"
else
    print_message $GREEN "✅ Node.js is available: $(node --version)"
fi

# Check for Python
print_message $YELLOW "🔍 Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    print_message $RED "❌ Python3 is not installed"
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip python3-venv
    print_message $GREEN "✅ Python3 installed successfully"
else
    print_message $GREEN "✅ Python3 is available: $(python3 --version)"
fi

# Setup Frontend
print_message $YELLOW "🎨 Setting up frontend..."
cd rupiyamaker-UI/crm

# Install frontend dependencies
if [ ! -d "node_modules" ]; then
    print_message $YELLOW "📦 Installing frontend dependencies..."
    npm install
fi

# Start frontend development server in background
print_message $YELLOW "🚀 Starting frontend server on port $FRONTEND_PORT..."
pkill -f "vite.*--port $FRONTEND_PORT" || true  # Kill existing process
npm run dev -- --host 0.0.0.0 --port $FRONTEND_PORT &
FRONTEND_PID=$!

print_message $GREEN "✅ Frontend started (PID: $FRONTEND_PID)"

# Setup Backend
print_message $YELLOW "⚡ Setting up backend..."
cd ../../backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_message $YELLOW "🐍 Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
print_message $YELLOW "📦 Installing backend dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Start backend server in background
print_message $YELLOW "🚀 Starting backend server on port $BACKEND_PORT..."
pkill -f "python.*app" || true  # Kill existing process

# Set environment variables
export PYTHONPATH="$PROJECT_DIR/backend"
export DOMAIN="$DOMAIN"

# Start backend
python3 -m app &
BACKEND_PID=$!

print_message $GREEN "✅ Backend started (PID: $BACKEND_PID)"

# Wait for services to start
print_message $YELLOW "⏳ Waiting for services to initialize..."
sleep 10

# Health checks
print_message $YELLOW "🔍 Performing health checks..."

# Check frontend
if curl -f http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
    print_message $GREEN "✅ Frontend health check passed"
else
    print_message $YELLOW "⚠️  Frontend might still be starting..."
fi

# Check backend
if curl -f http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
    print_message $GREEN "✅ Backend health check passed"
else
    print_message $YELLOW "⚠️  Backend might still be starting..."
fi

# Create process management file
cat > /tmp/rupiyamaker_pids.txt << EOF
FRONTEND_PID=$FRONTEND_PID
BACKEND_PID=$BACKEND_PID
FRONTEND_PORT=$FRONTEND_PORT
BACKEND_PORT=$BACKEND_PORT
STARTED_AT=$(date)
EOF

print_message $PURPLE "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_message $GREEN "🎉 RupiyaMaker CRM is now running natively!"
print_message $PURPLE "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_message $YELLOW "📱 Frontend: http://$DOMAIN:$FRONTEND_PORT"
print_message $YELLOW "⚡ Backend API: http://$DOMAIN:$BACKEND_PORT"
print_message $YELLOW "📚 API Docs: http://$DOMAIN:$BACKEND_PORT/docs"
print_message $YELLOW "🔗 Local access: http://localhost:$FRONTEND_PORT"
print_message $PURPLE ""
print_message $BLUE "🛠️  Development Mode: Both services running with hot reload"
print_message $PURPLE "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_message $BLUE "Process IDs saved to: /tmp/rupiyamaker_pids.txt"
print_message $BLUE "Frontend PID: $FRONTEND_PID"
print_message $BLUE "Backend PID: $BACKEND_PID"
print_message $PURPLE "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

print_message $GREEN "📋 Management commands:"
print_message $GREEN "   Stop services: ./stop-native.sh"
print_message $GREEN "   View logs: tail -f backend/backend.log"
print_message $GREEN "   Check status: ps aux | grep -E '(vite|python.*app)'"

print_message $BLUE "✨ Services are running in the background!"
print_message $BLUE "Use Ctrl+C to continue working, services will keep running."