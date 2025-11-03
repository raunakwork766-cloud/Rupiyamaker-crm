#!/bin/bash

# Unified Startup Script for RupiyaMe CRM
# This script starts both backend and frontend services

# Colors for better output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  RupiyaMe CRM Unified Startup${NC}"
echo -e "${BLUE}========================================${NC}"

# Get the current directory
CURRENT_DIR="/www/wwwroot/rupiyamaker/RupiyaMe"
BACKEND_DIR="$CURRENT_DIR/backend"
FRONTEND_DIR="$CURRENT_DIR/rupiyamaker-UI/crm"

# Set PM2 path
export PATH=$PATH:/www/server/nodejs/v20.19.5/bin

# Function to check if a service is running
check_service() {
    local service_name=$1
    if pm2 list | grep -q "$service_name"; then
        echo -e "${GREEN}✓ $service_name is running${NC}"
        return 0
    else
        echo -e "${RED}✗ $service_name is not running${NC}"
        return 1
    fi
}

# Function to start backend
start_backend() {
    echo -e "${YELLOW}Starting Backend Service...${NC}"
    
    # Check if virtual environment exists
    if [ ! -d "$BACKEND_DIR/venv" ]; then
        echo -e "${RED}Error: Python virtual environment not found at $BACKEND_DIR/venv${NC}"
        echo -e "${YELLOW}Please run setup-pm2.sh first to set up the backend${NC}"
        exit 1
    fi
    
    # Start or restart backend with PM2
    pm2 start "$CURRENT_DIR/pm2.config.json" --name "rupiyame-backend" || pm2 restart rupiyame-backend
    
    if check_service "rupiyame-backend"; then
        echo -e "${GREEN}✓ Backend started successfully${NC}"
    else
        echo -e "${RED}✗ Failed to start backend${NC}"
        exit 1
    fi
}

# Function to start frontend
start_frontend() {
    echo -e "${YELLOW}Starting Frontend Service...${NC}"
    
    # Check if frontend directory exists
    if [ ! -d "$FRONTEND_DIR" ]; then
        echo -e "${RED}Error: Frontend directory not found at $FRONTEND_DIR${NC}"
        exit 1
    fi
    
    # Check if package.json exists
    if [ ! -f "$FRONTEND_DIR/package.json" ]; then
        echo -e "${RED}Error: package.json not found in frontend directory${NC}"
        exit 1
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        echo -e "${YELLOW}Installing frontend dependencies...${NC}"
        cd "$FRONTEND_DIR"
        npm install
    fi
    
    # Start frontend with PM2
    cd "$FRONTEND_DIR"
    pm2 start npm --name "rupiyame-frontend" -- run dev || pm2 restart rupiyame-frontend
    
    if check_service "rupiyame-frontend"; then
        echo -e "${GREEN}✓ Frontend started successfully${NC}"
    else
        echo -e "${RED}✗ Failed to start frontend${NC}"
        exit 1
    fi
}

# Function to show status
show_status() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Service Status${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    pm2 list
    
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Service URLs${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "${GREEN}Backend: https://localhost:8049${NC}"
    echo -e "${GREEN}Frontend: http://localhost:4521${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Main execution
main() {
    # Check if PM2 is installed
    if ! command -v pm2 &> /dev/null; then
        echo -e "${RED}PM2 is not installed. Please run setup-pm2.sh first${NC}"
        exit 1
    fi
    
    # Start services
    start_backend
    sleep 2
    start_frontend
    sleep 2
    
    # Show status
    show_status
    
    echo -e "${GREEN}✓ Both backend and frontend services are now running!${NC}"
    echo -e "${YELLOW}Use 'pm2 logs' to view logs, 'pm2 stop all' to stop all services${NC}"
}

# Handle command line arguments
case "${1:-start}" in
    start)
        main
        ;;
    stop)
        echo -e "${YELLOW}Stopping all services...${NC}"
        pm2 stop all
        ;;
    restart)
        echo -e "${YELLOW}Restarting all services...${NC}"
        pm2 restart all
        ;;
    status)
        show_status
        ;;
    logs)
        pm2 logs
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo "  start   - Start both backend and frontend (default)"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        echo "  status  - Show service status"
        echo "  logs    - Show service logs"
        exit 1
        ;;
esac