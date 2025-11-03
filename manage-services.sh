#!/bin/bash
# RupiyaMe Full Stack Service Management Script

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Set Node.js path
export PATH="/www/server/nodejs/v24.11.0/bin:$PATH"

# Display banner
show_banner() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}   RupiyaMe Full Stack Manager${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Start services
start() {
    show_banner
    echo -e "${YELLOW}Starting backend and frontend services...${NC}"
    cd /www/wwwroot/RupiyaMe
    pm2 start pm2.config.json
    echo -e "${GREEN}✓ Services started${NC}"
}

# Stop services
stop() {
    show_banner
    echo -e "${YELLOW}Stopping backend and frontend services...${NC}"
    pm2 stop rupiyame-backend rupiyame-frontend
    echo -e "${GREEN}✓ Services stopped${NC}"
}

# Restart services
restart() {
    show_banner
    echo -e "${YELLOW}Restarting backend and frontend services...${NC}"
    pm2 restart rupiyame-backend rupiyame-frontend
    echo -e "${GREEN}✓ Services restarted${NC}"
}

# Show status
status() {
    show_banner
    echo -e "${BLUE}Service Status:${NC}"
    pm2 list
    echo ""
    echo -e "${BLUE}Port Status:${NC}"
    netstat -tlnp | grep -E "(4521|8049)"
}

# Show logs
logs() {
    show_banner
    if [ -z "$2" ]; then
        echo -e "${YELLOW}Showing logs for both services...${NC}"
        pm2 logs --lines 30
    else
        echo -e "${YELLOW}Showing logs for $2...${NC}"
        pm2 logs "$2" --lines 50
    fi
}

# Monitor services
monitor() {
    show_banner
    echo -e "${YELLOW}Monitoring services (Press Ctrl+C to exit)...${NC}"
    pm2 monit
}

# Save configuration
save() {
    show_banner
    echo -e "${YELLOW}Saving PM2 configuration...${NC}"
    pm2 save
    echo -e "${GREEN}✓ Configuration saved${NC}"
}

# Show help
help() {
    show_banner
    echo ""
    echo -e "${GREEN}Usage:${NC} $0 {start|stop|restart|status|logs|monitor|save}"
    echo ""
    echo -e "${YELLOW}Commands:${NC}"
    echo "  start    - Start both backend and frontend services"
    echo "  stop     - Stop both services"
    echo "  restart  - Restart both services"
    echo "  status   - Show service status and port information"
    echo "  logs     - Show logs (optional: logs backend/frontend)"
    echo "  monitor  - Open PM2 monitoring dashboard"
    echo "  save     - Save current PM2 configuration"
    echo ""
    echo -e "${YELLOW}Service URLs:${NC}"
    echo "  Backend:  https://rupiyamaker.com:8049"
    echo "  Frontend: https://rupiyamaker.com/"
    echo ""
}

# Main command handler
case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    logs)
        logs "$@"
        ;;
    monitor)
        monitor
        ;;
    save)
        save
        ;;
    *)
        help
        ;;
esac
