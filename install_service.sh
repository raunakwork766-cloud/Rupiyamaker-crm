#!/bin/bash

# Install RupiyaMe service script
# This script installs the RupiyaMe service to systemd

# Colors for better output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Installing RupiyaMe as a systemd service...${NC}"

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run this script with sudo:${NC} sudo $0"
  exit 1
fi

# Detect the location of the service file
SERVICE_FILE="/home/ubuntu/RupiyaMe/rupiyame.service"
if [ ! -f "$SERVICE_FILE" ]; then
  echo -e "${RED}Error: Service file not found at $SERVICE_FILE${NC}"
  exit 1
fi

# Copy the service file to systemd directory
echo "Copying service file to /etc/systemd/system/"
cp "$SERVICE_FILE" /etc/systemd/system/rupiyame.service

# Set proper permissions
echo "Setting permissions..."
chmod 644 /etc/systemd/system/rupiyame.service

# Check if the virtual environment exists
VENV_PATH="/home/ubuntu/RupiyaMe/backend/venv"
if [ ! -d "$VENV_PATH" ]; then
  echo -e "${YELLOW}Warning: Virtual environment not found at $VENV_PATH${NC}"
  echo "Creating virtual environment..."
  
  # Change to the backend directory
  cd /home/ubuntu/RupiyaMe/backend
  
  # Create virtual environment
  python3 -m venv venv
  
  # Activate and install requirements if requirements.txt exists
  if [ -f "requirements.txt" ]; then
    echo "Installing dependencies from requirements.txt..."
    source venv/bin/activate
    pip install -r requirements.txt
    deactivate
  else
    echo -e "${YELLOW}Warning: requirements.txt not found. Dependencies not installed.${NC}"
  fi
fi

# Reload systemd configurations
echo "Reloading systemd configurations..."
systemctl daemon-reload

# Enable the service to start on boot
echo "Enabling RupiyaMe service to start on boot..."
systemctl enable rupiyame.service

# Start the service
echo "Starting RupiyaMe service..."
systemctl start rupiyame.service

# Check service status
echo "Checking service status..."
systemctl status rupiyame.service

echo -e "${GREEN}RupiyaMe service has been installed and started!${NC}"
echo ""
echo "You can manage the service using these commands:"
echo "  sudo systemctl start rupiyame.service    # Start the service"
echo "  sudo systemctl stop rupiyame.service     # Stop the service"
echo "  sudo systemctl restart rupiyame.service  # Restart the service"
echo "  sudo systemctl status rupiyame.service   # Check service status"
echo "  journalctl -u rupiyame.service           # View service logs"
