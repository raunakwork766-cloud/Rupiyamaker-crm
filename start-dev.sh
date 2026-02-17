#!/bin/bash
# Start Development Environment on Separate Ports
# Production (main): Backend 8049, Frontend 4521
# Development (dev): Backend 8050, Frontend 4522

echo "======================================"
echo "Starting Development Environment"
echo "======================================"

# Ensure we're on dev branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "dev" ]; then
    echo "⚠️  Not on dev branch. Switching to dev..."
    git checkout dev
fi

echo ""
echo "Branch: $(git branch --show-current)"
echo "Backend Dev Port: 8051"
echo "Frontend Dev Port: 4522"
echo ""

# Stop existing dev services if running
echo "Stopping existing dev services..."
pm2 delete rupiyame-backend-dev 2>/dev/null
pm2 delete rupiyame-frontend-dev 2>/dev/null

# Start dev services
echo "Starting dev services..."
pm2 start ecosystem.dev.config.js

echo ""
echo "======================================"
echo "✓ Dev Environment Started!"
echo "======================================"
echo ""
echo "Access URLs:"
echo "  Frontend Dev: http://SERVER_IP:4522"
echo "  Backend Dev:  http://SERVER_IP:8051"
echo ""
echo "Production URLs (unchanged):"
echo "  Frontend:     https://rupiyamaker.com"
echo "  Backend:      https://rupiyamaker.com/api"
echo ""
echo "Commands:"
echo "  Check status:  pm2 status"
echo "  View logs:     pm2 logs rupiyame-backend-dev"
echo "  Stop dev:      pm2 stop rupiyame-backend-dev rupiyame-frontend-dev"
echo ""
