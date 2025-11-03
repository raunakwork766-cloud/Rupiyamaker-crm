#!/bin/bash

# PM2 Setup Script for RupiyaMe CRM Backend
# This script installs and configures PM2 to run the backend continuously

# Colors for better output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  RupiyaMe CRM PM2 Setup${NC}"
echo -e "${BLUE}========================================${NC}"

# Get the current directory
CURRENT_DIR="/www/wwwroot/rupiyamaker/RupiyaMe"
BACKEND_DIR="$CURRENT_DIR/backend"

# Create logs directory if it doesn't exist
mkdir -p "$CURRENT_DIR/logs"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js is not installed. Installing Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 is not installed. Installing PM2 globally...${NC}"
    npm install -g pm2
fi

# Check if virtual environment exists
VENV_PATH="$BACKEND_DIR/venv"
if [ ! -d "$VENV_PATH" ]; then
  echo -e "${YELLOW}Creating Python virtual environment...${NC}"
  
  cd "$BACKEND_DIR"
  python3 -m venv venv
  
  if [ -f "requirements.txt" ]; then
    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate
  fi
fi

# Stop any existing PM2 processes
echo -e "${YELLOW}Stopping any existing RupiyaMe processes...${NC}"
pm2 delete rupiyame-backend 2>/dev/null || true

# Start the application with PM2
echo -e "${YELLOW}Starting RupiyaMe backend with PM2...${NC}"
cd "$CURRENT_DIR"
pm2 start pm2.config.json

# Save PM2 process list
echo -e "${YELLOW}Saving PM2 process list...${NC}"
pm2 save

# Setup PM2 to start on boot
echo -e "${YELLOW}Setting up PM2 to start on boot...${NC}"
pm2 startup | grep -E '^sudo' | sh

# Wait a moment for the service to start
sleep 5

# Check if the process is running
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Process Status${NC}"
echo -e "${BLUE}========================================${NC}"

pm2 list

if pm2 describe rupiyame-backend &> /dev/null; then
  echo -e "${GREEN}✅ RupiyaMe backend is running with PM2!${NC}"
  echo -e "${GREEN}✅ Process will automatically restart on failure${NC}"
  echo -e "${GREEN}✅ Process will start automatically on system boot${NC}"
else
  echo -e "${RED}❌ Failed to start RupiyaMe backend${NC}"
  echo -e "${YELLOW}Checking logs...${NC}"
  pm2 logs rupiyame-backend --lines 20
  exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Useful PM2 Commands${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}View process list:${NC} pm2 list"
echo -e "${YELLOW}View logs:${NC} pm2 logs rupiyame-backend"
echo -e "${YELLOW}Monitor process:${NC} pm2 monit"
echo -e "${YELLOW}Restart process:${NC} pm2 restart rupiyame-backend"
echo -e "${YELLOW}Stop process:${NC} pm2 stop rupiyame-backend"
echo -e "${YELLOW}Delete process:${NC} pm2 delete rupiyame-backend"
echo -e "${YELLOW}View detailed info:${NC} pm2 describe rupiyame-backend"

echo ""
echo -e "${GREEN}🎉 PM2 setup completed successfully!${NC}"
echo -e "${GREEN}Your RupiyaMe CRM backend is now running continuously with PM2.${NC}"