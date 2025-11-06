#!/bin/bash

# RupiyaMaker Frontend Control Script
# Easy management for production frontend service

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="/www/wwwroot/RupiyaMe"
RUNNER_SCRIPT="$SCRIPT_DIR/frontend-runner.sh"

echo -e "${BLUE}🚀 RupiyaMaker Frontend Control Panel${NC}"
echo -e "${BLUE}======================================${NC}"

case "$1" in
    start)
        echo -e "${GREEN}🟢 Starting frontend service...${NC}"
        $RUNNER_SCRIPT start
        echo -e "\n${BLUE}💡 Service will auto-start on boot${NC}"
        ;;
    stop)
        echo -e "${YELLOW}🟡 Stopping frontend service...${NC}"
        $RUNNER_SCRIPT stop
        ;;
    restart)
        echo -e "${YELLOW}🔄 Restarting frontend service...${NC}"
        $RUNNER_SCRIPT restart
        ;;
    status)
        $RUNNER_SCRIPT status
        echo -e "\n${BLUE}🔧 System Service Status:${NC}"
        systemctl is-active rupiyame-frontend.service --quiet && echo -e "${GREEN}✅ Systemd service: Active${NC}" || echo -e "${YELLOW}⚠️  Systemd service: Inactive${NC}"
        systemctl is-enabled rupiyame-frontend.service --quiet && echo -e "${GREEN}✅ Auto-start: Enabled${NC}" || echo -e "${YELLOW}⚠️  Auto-start: Disabled${NC}"
        ;;
    logs)
        echo -e "${BLUE}📋 Following frontend logs...${NC}"
        $RUNNER_SCRIPT logs
        ;;
    enable)
        echo -e "${GREEN}🔧 Enabling auto-start on boot...${NC}"
        systemctl enable rupiyame-frontend.service
        echo -e "${GREEN}✅ Frontend will start automatically on server boot${NC}"
        ;;
    disable)
        echo -e "${YELLOW}🔧 Disabling auto-start on boot...${NC}"
        systemctl disable rupiyame-frontend.service
        echo -e "${YELLOW}⚠️  Frontend will not start automatically on server boot${NC}"
        ;;
    install)
        echo -e "${BLUE}📦 Setting up frontend for production...${NC}"
        
        # Make scripts executable
        chmod +x "$RUNNER_SCRIPT"
        
        # Enable systemd service
        systemctl daemon-reload
        systemctl enable rupiyame-frontend.service
        
        # Start the service
        $RUNNER_SCRIPT start
        
        echo -e "${GREEN}✅ Frontend production setup complete!${NC}"
        echo -e "${GREEN}🌐 Access URL: http://$(hostname -I | awk '{print $1}'):4521${NC}"
        echo -e "${GREEN}🔄 Auto-restart: Enabled${NC}"
        echo -e "${GREEN}🚀 Boot startup: Enabled${NC}"
        ;;
    *)
        echo -e "${GREEN}Available commands:${NC}"
        echo -e "  ${YELLOW}start${NC}    - Start the frontend"
        echo -e "  ${YELLOW}stop${NC}     - Stop the frontend"
        echo -e "  ${YELLOW}restart${NC}  - Restart the frontend"
        echo -e "  ${YELLOW}status${NC}   - Show detailed status"
        echo -e "  ${YELLOW}logs${NC}     - Follow live logs"
        echo -e "  ${YELLOW}enable${NC}   - Enable auto-start on boot"
        echo -e "  ${YELLOW}disable${NC}  - Disable auto-start on boot"
        echo -e "  ${YELLOW}install${NC}  - Complete production setup"
        echo -e ""
        echo -e "${BLUE}Examples:${NC}"
        echo -e "  $0 install   # Complete setup for production"
        echo -e "  $0 status    # Check current status"
        echo -e "  $0 logs      # Watch live logs"
        exit 1
        ;;
esac