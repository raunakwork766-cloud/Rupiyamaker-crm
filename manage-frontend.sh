#!/bin/bash

# RupiyaMaker Frontend Management Script
# This script helps manage the frontend development server

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

FRONTEND_DIR="/www/wwwroot/rupiyamaker/RupiyaMe/rupiyamaker-UI/crm"
PM2_CONFIG="/www/wwwroot/rupiyamaker/RupiyaMe/pm2-frontend.config.json"
LOG_DIR="/www/wwwroot/rupiyamaker/RupiyaMe/logs"

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}   RupiyaMaker Frontend Manager ${NC}"
    echo -e "${BLUE}================================${NC}"
}

check_dependencies() {
    echo -e "${YELLOW}Checking dependencies...${NC}"
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm is not installed${NC}"
        return 1
    else
        echo -e "${GREEN}✅ npm: $(npm --version)${NC}"
    fi
    
    # Check if PM2 is installed
    if ! command -v pm2 &> /dev/null; then
        echo -e "${YELLOW}⚠️  PM2 not installed. Installing PM2...${NC}"
        npm install -g pm2
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ PM2 installed successfully${NC}"
        else
            echo -e "${RED}❌ Failed to install PM2${NC}"
            return 1
        fi
    else
        echo -e "${GREEN}✅ PM2: $(pm2 --version)${NC}"
    fi
    
    return 0
}

install_dependencies() {
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd "$FRONTEND_DIR"
    
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ package.json not found in $FRONTEND_DIR${NC}"
        return 1
    fi
    
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        return 1
    fi
}

start_frontend() {
    echo -e "${YELLOW}Starting frontend server...${NC}"
    
    # Create logs directory if it doesn't exist
    mkdir -p "$LOG_DIR"
    
    # Stop any existing process
    pm2 delete rupiyame-frontend 2>/dev/null || true
    
    # Start with PM2 using config file
    cd "$FRONTEND_DIR"
    pm2 start "$PM2_CONFIG"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Frontend server started successfully${NC}"
        pm2 save
        echo -e "${BLUE}📊 PM2 Status:${NC}"
        pm2 status
        echo -e "${BLUE}🌐 Frontend URL: http://localhost:4521${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to start frontend server${NC}"
        return 1
    fi
}

stop_frontend() {
    echo -e "${YELLOW}Stopping frontend server...${NC}"
    pm2 delete rupiyame-frontend
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Frontend server stopped${NC}"
    else
        echo -e "${YELLOW}⚠️  No frontend process found${NC}"
    fi
}

restart_frontend() {
    echo -e "${YELLOW}Restarting frontend server...${NC}"
    pm2 restart rupiyame-frontend 2>/dev/null || start_frontend
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Frontend server restarted${NC}"
    fi
}

status_frontend() {
    echo -e "${BLUE}📊 Frontend Status:${NC}"
    pm2 status rupiyame-frontend
    
    echo -e "\n${BLUE}🌐 Port Status:${NC}"
    netstat -tlnp | grep -E "(4521|4522)" || echo "No processes found on ports 4521/4522"
    
    echo -e "\n${BLUE}📋 Recent Logs:${NC}"
    if [ -f "$LOG_DIR/frontend-combined.log" ]; then
        tail -n 20 "$LOG_DIR/frontend-combined.log"
    else
        echo "No logs found"
    fi
}

setup_autostart() {
    echo -e "${YELLOW}Setting up auto-start on boot...${NC}"
    
    # Enable PM2 startup
    pm2 startup systemd -u root --hp /root
    pm2 save
    
    # Enable systemd service
    systemctl daemon-reload
    systemctl enable rupiyame-frontend.service
    
    echo -e "${GREEN}✅ Auto-start configured${NC}"
    echo -e "${BLUE}💡 Frontend will now start automatically on system boot${NC}"
}

show_logs() {
    echo -e "${BLUE}📋 Real-time Frontend Logs:${NC}"
    echo -e "${YELLOW}Press Ctrl+C to exit log view${NC}"
    pm2 logs rupiyame-frontend --lines 100
}

show_help() {
    echo -e "${BLUE}Usage: $0 {start|stop|restart|status|setup|logs|install|help}${NC}"
    echo ""
    echo -e "${YELLOW}Commands:${NC}"
    echo -e "  ${GREEN}start${NC}     - Start the frontend server"
    echo -e "  ${GREEN}stop${NC}      - Stop the frontend server"
    echo -e "  ${GREEN}restart${NC}   - Restart the frontend server"
    echo -e "  ${GREEN}status${NC}    - Show frontend status and logs"
    echo -e "  ${GREEN}setup${NC}     - Complete setup with auto-start"
    echo -e "  ${GREEN}logs${NC}      - Show real-time logs"
    echo -e "  ${GREEN}install${NC}   - Install dependencies"
    echo -e "  ${GREEN}help${NC}      - Show this help message"
    echo ""
    echo -e "${BLUE}Examples:${NC}"
    echo -e "  $0 start     # Start frontend server"
    echo -e "  $0 status    # Check if running"
    echo -e "  $0 setup     # Full setup with auto-start"
}

# Main script logic
print_header

case "$1" in
    start)
        check_dependencies && start_frontend
        ;;
    stop)
        stop_frontend
        ;;
    restart)
        check_dependencies && restart_frontend
        ;;
    status)
        status_frontend
        ;;
    setup)
        echo -e "${YELLOW}🚀 Running complete frontend setup...${NC}"
        check_dependencies && install_dependencies && start_frontend && setup_autostart
        echo -e "${GREEN}✅ Setup completed! Frontend is now running and will auto-start on boot.${NC}"
        ;;
    logs)
        show_logs
        ;;
    install)
        check_dependencies && install_dependencies
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac