#!/bin/bash

# Quick Status Check for RupiyaMe CRM Services
# Colors for better output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  RupiyaMe CRM Services Status${NC}"
echo -e "${BLUE}========================================${NC}"

# Export PM2 PATH
export PATH=$PATH:/www/server/nodejs/v20.19.5/bin

# Check PM2 processes
echo -e "${YELLOW}PM2 Processes:${NC}"
pm2 list

echo -e "\n${YELLOW}Port Status:${NC}"
# Check Backend Port
if netstat -tlnp | grep -q ":8049"; then
    echo -e "${GREEN}✓ Backend running on port 8049${NC}"
else
    echo -e "${RED}✗ Backend not running on port 8049${NC}"
fi

# Check Frontend Port
if netstat -tlnp | grep -q ":4521"; then
    echo -e "${GREEN}✓ Frontend running on port 4521${NC}"
else
    echo -e "${RED}✗ Frontend not running on port 4521${NC}"
fi

echo -e "\n${YELLOW}Service URLs:${NC}"
echo -e "${GREEN}Backend API: https://localhost:8049${NC}"
echo -e "${GREEN}Frontend App: http://localhost:4521${NC}"

echo -e "\n${YELLOW}Quick Test:${NC}"
# Test frontend
if curl -s -I http://localhost:4521 | grep -q "200 OK"; then
    echo -e "${GREEN}✓ Frontend is accessible${NC}"
else
    echo -e "${RED}✗ Frontend is not accessible${NC}"
fi

# Test backend
if curl -k -s -I https://localhost:8049/settings/bank-names | grep -q "405\|200"; then
    echo -e "${GREEN}✓ Backend API is responding${NC}"
else
    echo -e "${RED}✗ Backend API is not responding${NC}"
fi

echo -e "\n${BLUE}========================================${NC}"