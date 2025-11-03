#!/bin/bash

# Enhanced PM2 Setup Script for RupiyaMe CRM (Backend + Frontend)
# This script installs and configures PM2 to run both backend and frontend continuously

# Colors for better output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  RupiyaMe CRM Full Stack Setup${NC}"
echo -e "${BLUE}========================================${NC}"

# Get the current directory
CURRENT_DIR="/www/wwwroot/rupiyamaker/RupiyaMe"
BACKEND_DIR="$CURRENT_DIR/backend"
FRONTEND_DIR="$CURRENT_DIR/rupiyamaker-UI/crm"

# Create logs directory if it doesn't exist
mkdir -p "$CURRENT_DIR/logs"

echo -e "${YELLOW}Setting up directories and permissions...${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js is not installed. Installing Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Check Node.js version
NODE_VERSION=$(node --version)
echo -e "${GREEN}Node.js version: $NODE_VERSION${NC}"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 is not installed. Installing PM2 globally...${NC}"
    npm install -g pm2
fi

# Check PM2 version
PM2_VERSION=$(pm2 --version)
echo -e "${GREEN}PM2 version: $PM2_VERSION${NC}"

# Backend Setup
echo -e "${BLUE}----------------------------------------${NC}"
echo -e "${BLUE}  Backend Setup${NC}"
echo -e "${BLUE}----------------------------------------${NC}"

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
    echo -e "${GREEN}✓ Python dependencies installed${NC}"
  else
    echo -e "${YELLOW}Warning: requirements.txt not found in backend directory${NC}"
  fi
else
  echo -e "${GREEN}✓ Python virtual environment already exists${NC}"
fi

# Frontend Setup
echo -e "${BLUE}----------------------------------------${NC}"
echo -e "${BLUE}  Frontend Setup${NC}"
echo -e "${BLUE}----------------------------------------${NC}"

if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}Error: Frontend directory not found at $FRONTEND_DIR${NC}"
    exit 1
fi

cd "$FRONTEND_DIR"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found in frontend directory${NC}"
    exit 1
fi

# Install frontend dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Frontend dependencies already installed${NC}"
fi

# PM2 Configuration
echo -e "${BLUE}----------------------------------------${NC}"
echo -e "${BLUE}  PM2 Configuration${NC}"
echo -e "${BLUE}----------------------------------------${NC}"

cd "$CURRENT_DIR"

# Copy the ecosystem config
cp pm2.ecosystem.json pm2.config.json 2>/dev/null || echo -e "${YELLOW}Ecosystem config will be used directly${NC}"

echo -e "${GREEN}✓ PM2 configuration ready${NC}"

# Set up PM2 startup
echo -e "${YELLOW}Setting up PM2 startup...${NC}"
pm2 startup systemd -u $(whoami) --hp $(eval echo ~$(whoami))

echo -e "${BLUE}----------------------------------------${NC}"
echo -e "${BLUE}  Setup Complete!${NC}"
echo -e "${BLUE}----------------------------------------${NC}"
echo -e "${GREEN}✓ Backend setup complete${NC}"
echo -e "${GREEN}✓ Frontend setup complete${NC}"
echo -e "${GREEN}✓ PM2 configuration ready${NC}"
echo ""
echo -e "${YELLOW}To start both services, run:${NC}"
echo -e "${BLUE}  ./start-full-crm.sh${NC}"
echo ""
echo -e "${YELLOW}Other useful commands:${NC}"
echo -e "${BLUE}  ./start-full-crm.sh start    - Start all services${NC}"
echo -e "${BLUE}  ./start-full-crm.sh stop     - Stop all services${NC}"
echo -e "${BLUE}  ./start-full-crm.sh restart  - Restart all services${NC}"
echo -e "${BLUE}  ./start-full-crm.sh status   - Show service status${NC}"
echo -e "${BLUE}  ./start-full-crm.sh logs     - Show service logs${NC}"
echo ""
echo -e "${GREEN}Setup completed successfully!${NC}"