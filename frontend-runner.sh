#!/bin/bash

# Simple Frontend Runner without PM2 dependency
# This script ensures the frontend always runs

FRONTEND_DIR="/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm"
PID_FILE="/var/run/rupiyame-frontend.pid"
LOG_DIR="/www/wwwroot/RupiyaMe/logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}=====================================${NC}"
    echo -e "${BLUE}   RupiyaMaker Frontend Status       ${NC}"
    echo -e "${BLUE}=====================================${NC}"
}

create_log_dir() {
    mkdir -p "$LOG_DIR"
}

is_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

start_frontend() {
    echo -e "${YELLOW}Starting RupiyaMaker Frontend...${NC}"
    
    if is_running; then
        echo -e "${YELLOW}⚠️  Frontend is already running (PID: $(cat $PID_FILE))${NC}"
        return 0
    fi
    
    # Create log directory
    create_log_dir
    
    # Kill any existing vite processes
    pkill -f "vite.*452[12]" 2>/dev/null || true
    sleep 2
    
    # Change to frontend directory
    cd "$FRONTEND_DIR"
    
    # Start the frontend in background
    echo -e "${BLUE}📡 Starting Vite development server...${NC}"
    nohup npm run dev > "$LOG_DIR/frontend-out.log" 2> "$LOG_DIR/frontend-error.log" &
    FRONTEND_PID=$!
    
    # Save PID
    echo $FRONTEND_PID > "$PID_FILE"
    
    # Wait and check if it started successfully
    sleep 8
    
    if ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
        # Check if port is listening
        if netstat -tlnp 2>/dev/null | grep -q ":452[12]"; then
            PORT=$(netstat -tlnp 2>/dev/null | grep ":452[12]" | head -1 | awk '{print $4}' | cut -d: -f2)
            echo -e "${GREEN}✅ Frontend started successfully!${NC}"
            echo -e "${GREEN}🌐 Local URL: http://localhost:$PORT${NC}"
            echo -e "${GREEN}🌐 Network URL: http://$(hostname -I | awk '{print $1}'):$PORT${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  Frontend process started but port not detected yet...${NC}"
            echo -e "${BLUE}💡 Check logs: tail -f $LOG_DIR/frontend-*.log${NC}"
            return 0
        fi
    else
        echo -e "${RED}❌ Failed to start frontend${NC}"
        rm -f "$PID_FILE"
        return 1
    fi
}

stop_frontend() {
    echo -e "${YELLOW}Stopping RupiyaMaker Frontend...${NC}"
    
    if is_running; then
        PID=$(cat "$PID_FILE")
        kill "$PID" 2>/dev/null
        sleep 3
        
        if ps -p "$PID" > /dev/null 2>&1; then
            kill -9 "$PID" 2>/dev/null
        fi
        
        rm -f "$PID_FILE"
        echo -e "${GREEN}✅ Frontend stopped${NC}"
    else
        echo -e "${YELLOW}⚠️  Frontend is not running${NC}"
    fi
    
    # Also kill any remaining vite processes
    pkill -f "vite.*452[12]" 2>/dev/null || true
}

restart_frontend() {
    stop_frontend
    sleep 2
    start_frontend
}

status_frontend() {
    print_status
    
    if is_running; then
        PID=$(cat "$PID_FILE")
        echo -e "${GREEN}✅ Frontend is running (PID: $PID)${NC}"
        
        # Check port
        if netstat -tlnp 2>/dev/null | grep -q ":452[12]"; then
            PORT=$(netstat -tlnp 2>/dev/null | grep ":452[12]" | head -1 | awk '{print $4}' | cut -d: -f2)
            echo -e "${GREEN}🌐 Listening on port: $PORT${NC}"
        fi
        
        # Show process info
        echo -e "\n${BLUE}📊 Process Info:${NC}"
        ps -p "$PID" -o pid,ppid,cmd --no-headers 2>/dev/null || echo "Process not found"
        
    else
        echo -e "${RED}❌ Frontend is not running${NC}"
    fi
    
    # Show recent logs
    echo -e "\n${BLUE}📋 Recent Output (last 15 lines):${NC}"
    if [ -f "$LOG_DIR/frontend-out.log" ]; then
        tail -n 15 "$LOG_DIR/frontend-out.log" | head -10
    else
        echo "No output logs found"
    fi
    
    echo -e "\n${BLUE}🚨 Recent Errors (last 5 lines):${NC}"
    if [ -f "$LOG_DIR/frontend-error.log" ]; then
        tail -n 5 "$LOG_DIR/frontend-error.log"
    else
        echo "No error logs found"
    fi
}

show_logs() {
    echo -e "${BLUE}📋 Following Frontend Logs (Ctrl+C to exit):${NC}"
    echo -e "${YELLOW}Output Log: $LOG_DIR/frontend-out.log${NC}"
    echo -e "${YELLOW}Error Log: $LOG_DIR/frontend-error.log${NC}"
    echo ""
    
    if [ -f "$LOG_DIR/frontend-out.log" ]; then
        tail -f "$LOG_DIR/frontend-out.log"
    else
        echo "No logs found. Start the frontend first."
    fi
}

case "$1" in
    start)
        start_frontend
        ;;
    stop)
        stop_frontend
        ;;
    restart)
        restart_frontend
        ;;
    status)
        status_frontend
        ;;
    logs)
        show_logs
        ;;
    *)
        echo -e "${BLUE}RupiyaMaker Frontend Manager${NC}"
        echo -e "${YELLOW}Usage: $0 {start|stop|restart|status|logs}${NC}"
        echo ""
        echo -e "${GREEN}Commands:${NC}"
        echo -e "  start   - Start the frontend server"
        echo -e "  stop    - Stop the frontend server"
        echo -e "  restart - Restart the frontend server"
        echo -e "  status  - Show current status and logs"
        echo -e "  logs    - Follow live logs"
        exit 1
        ;;
esac