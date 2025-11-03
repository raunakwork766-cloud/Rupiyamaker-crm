#!/bin/bash

# Install RupiyaMe CRM service script for current path
# This script installs the RupiyaMe service to systemd with updated paths

# Colors for better output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  RupiyaMe CRM Service Installer${NC}"
echo -e "${BLUE}========================================${NC}"

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run this script with sudo:${NC} sudo bash install-rupiyame-service.sh"
  exit 1
fi

# Get the current directory
CURRENT_DIR="/www/wwwroot/rupiyamaker/RupiyaMe"
SERVICE_FILE="$CURRENT_DIR/rupiyame-updated.service"
BACKEND_DIR="$CURRENT_DIR/backend"

echo -e "${YELLOW}Installing RupiyaMe CRM as a systemd service...${NC}"

# Check if service file exists
if [ ! -f "$SERVICE_FILE" ]; then
  echo -e "${RED}Error: Service file not found at $SERVICE_FILE${NC}"
  exit 1
fi

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
  echo -e "${RED}Error: Backend directory not found at $BACKEND_DIR${NC}"
  exit 1
fi

# Stop any existing service
echo -e "${YELLOW}Stopping any existing RupiyaMe service...${NC}"
systemctl stop rupiyame 2>/dev/null || true

# Copy the service file to systemd directory
echo -e "${YELLOW}Installing service file...${NC}"
cp "$SERVICE_FILE" /etc/systemd/system/rupiyame.service

# Set proper permissions
chmod 644 /etc/systemd/system/rupiyame.service

# Check if virtual environment exists
VENV_PATH="$BACKEND_DIR/venv"
if [ ! -d "$VENV_PATH" ]; then
  echo -e "${YELLOW}Creating Python virtual environment...${NC}"
  
  # Change to the backend directory
  cd "$BACKEND_DIR"
  
  # Create virtual environment
  python3 -m venv venv
  
  # Activate and install requirements if requirements.txt exists
  if [ -f "requirements.txt" ]; then
    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate
  else
    echo -e "${YELLOW}No requirements.txt found, skipping dependency installation${NC}"
  fi
else
  echo -e "${GREEN}Virtual environment already exists${NC}"
fi

# Reload systemd daemon
echo -e "${YELLOW}Reloading systemd daemon...${NC}"
systemctl daemon-reload

# Enable the service to start on boot
echo -e "${YELLOW}Enabling service to start on boot...${NC}"
systemctl enable rupiyame

# Start the service
echo -e "${YELLOW}Starting RupiyaMe service...${NC}"
systemctl start rupiyame

# Wait a moment for the service to start
sleep 3

# Check service status
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Service Status${NC}"
echo -e "${BLUE}========================================${NC}"

if systemctl is-active --quiet rupiyame; then
  echo -e "${GREEN}✅ RupiyaMe service is running successfully!${NC}"
  echo -e "${GREEN}✅ Service will automatically start on system boot${NC}"
else
  echo -e "${RED}❌ Service failed to start${NC}"
  echo -e "${YELLOW}Checking logs for errors...${NC}"
  journalctl -u rupiyame -n 20 --no-pager
  exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Useful Commands${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Check service status:${NC} systemctl status rupiyame"
echo -e "${YELLOW}Stop service:${NC} sudo systemctl stop rupiyame"
echo -e "${YELLOW}Start service:${NC} sudo systemctl start rupiyame"
echo -e "${YELLOW}Restart service:${NC} sudo systemctl restart rupiyame"
echo -e "${YELLOW}View logs:${NC} journalctl -u rupiyame -f"
echo -e "${YELLOW}View recent logs:${NC} journalctl -u rupiyame -n 50"

echo ""
echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
echo -e "${GREEN}Your RupiyaMe CRM backend will now run continuously, even after reboots.${NC}"