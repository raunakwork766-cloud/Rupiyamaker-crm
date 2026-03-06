#!/bin/bash
# RupiyaMe Server Performance Optimization Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Server Performance Optimization${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

BASE_DIR="/www/wwwroot/RupiyaMe"

echo -e "${GREEN}Step 1: Checking current PM2 processes...${NC}"
pm2 list
echo ""

echo -e "${GREEN}Step 2: Optimizing PM2 log rotation...${NC}"
# Install PM2 log rotate if not already installed
pm2 install pm2-logrotate 2>/dev/null || echo "pm2-logrotate already installed"

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:rotateModule true

echo -e "${GREEN}✓ PM2 log rotation configured (10MB max, keep 7 days, compress old logs)${NC}"
echo ""

echo -e "${GREEN}Step 3: Cleaning PM2 old logs...${NC}"
pm2 flush
echo -e "${GREEN}✓ PM2 logs flushed${NC}"
echo ""

echo -e "${GREEN}Step 4: Checking for development vs production processes...${NC}"
# Check if both dev and prod are running
DEV_RUNNING=$(pm2 list | grep -c "rupiyame.*-dev" || echo "0")
PROD_RUNNING=$(pm2 list | grep -c "rupiyame-backend\|rupiyame-frontend" | grep -v "dev" || echo "0")

echo "Development processes running: $DEV_RUNNING"
echo "Production processes running: $PROD_RUNNING"

if [ "$DEV_RUNNING" -gt 0 ] && [ "$PROD_RUNNING" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Both development and production processes are running!${NC}"
    echo -e "${YELLOW}This is consuming double resources.${NC}"
    echo ""
    echo "Would you like to:"
    echo "1) Keep only PRODUCTION (recommended for live server)"
    echo "2) Keep only DEVELOPMENT (for testing)"
    echo "3) Keep both (not recommended)"
    echo ""
    echo -e "${YELLOW}Run manually:${NC}"
    echo -e "${YELLOW}  For Production only: pm2 stop rupiyame-backend-dev rupiyame-frontend-dev${NC}"
    echo -e "${YELLOW}  For Development only: pm2 stop rupiyame-backend rupiyame-frontend${NC}"
    echo ""
fi

echo -e "${GREEN}Step 5: Optimizing backend Python environment...${NC}"
cd "$BASE_DIR/backend"

# Check for unnecessary packages
echo "Checking for unused Python packages..."
if [ -f "requirements.txt" ]; then
    echo -e "${GREEN}✓ requirements.txt found${NC}"
    
    # Show installed packages count
    INSTALLED_COUNT=$(./venv/bin/pip list 2>/dev/null | wc -l)
    echo "Installed packages: $INSTALLED_COUNT"
fi
echo ""

echo -e "${GREEN}Step 6: Frontend optimization check...${NC}"
cd "$BASE_DIR/rupiyamaker-UI/crm"

# Check node_modules size
NODE_MODULES_SIZE=$(du -sh node_modules 2>/dev/null | cut -f1)
echo "node_modules size: $NODE_MODULES_SIZE"

# Check if there are development dependencies in production
echo "Checking package.json..."
if [ -f "package.json" ]; then
    DEV_DEPS=$(cat package.json | grep -c '"devDependencies"' || echo "0")
    if [ "$DEV_DEPS" -gt 0 ]; then
        echo -e "${YELLOW}Note: Development dependencies found${NC}"
        echo -e "${YELLOW}For production, you can reinstall with: npm ci --production${NC}"
    fi
fi
echo ""

echo -e "${GREEN}Step 7: Checking for .vite cache...${NC}"
cd "$BASE_DIR"
if [ -d ".vite" ]; then
    VITE_SIZE=$(du -sh .vite 2>/dev/null | cut -f1)
    echo "Vite cache size: $VITE_SIZE"
    echo "You can clear it with: rm -rf .vite"
fi
echo ""

echo -e "${GREEN}Step 8: Database optimization suggestions...${NC}"
echo "For MongoDB optimization, you can:"
echo "1) Add indexes to frequently queried fields"
echo "2) Enable MongoDB compression"
echo "3) Archive old data periodically"
echo "4) Monitor slow queries with MongoDB profiler"
echo ""

echo -e "${GREEN}Step 9: Memory usage analysis...${NC}"
pm2 list
echo ""
free -h 2>/dev/null || echo "Memory info not available"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}       OPTIMIZATION SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}✓ PM2 log rotation configured${NC}"
echo -e "${GREEN}✓ Old PM2 logs cleared${NC}"
echo -e "${GREEN}✓ Performance checks completed${NC}"
echo ""

echo -e "${YELLOW}RECOMMENDATIONS:${NC}"
echo ""
echo "1. ${YELLOW}Memory Usage:${NC}"
echo "   - Backend (dev): 250MB"
echo "   - Backend (prod): 173MB"
echo "   - Consider running only ONE environment at a time"
echo ""
echo "2. ${YELLOW}Log Management:${NC}"
echo "   - PM2 log rotation is now active"
echo "   - Logs will auto-rotate at 10MB"
echo "   - Old logs will be compressed"
echo ""
echo "3. ${YELLOW}Code Cleanup:${NC}"
echo "   - Run ./cleanup_codebase.sh to clean unused files"
echo "   - This will free up space and improve clarity"
echo ""
echo "4. ${YELLOW}Frontend Development Mode:${NC}"
echo "   - Frontend is running in dev mode (npm run dev)"
echo "   - For production, build with: npm run build"
echo "   - Serve built files with a static server (nginx/apache)"
echo ""
echo "5. ${YELLOW}Process Management:${NC}"
echo "   - Stop unused processes: pm2 stop <process-name>"
echo "   - Remove from PM2: pm2 delete <process-name>"
echo "   - Save PM2 config: pm2 save"
echo ""

echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}To apply code cleanup, run:${NC}"
echo -e "${YELLOW}chmod +x cleanup_codebase.sh && ./cleanup_codebase.sh${NC}"
echo ""
