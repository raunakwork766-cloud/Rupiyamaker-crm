#!/bin/bash
# Stop Development Environment

echo "======================================"
echo "Stopping Development Environment"
echo "======================================"

pm2 stop rupiyame-backend-dev rupiyame-frontend-dev 2>/dev/null
pm2 delete rupiyame-backend-dev rupiyame-frontend-dev 2>/dev/null

echo ""
echo "✓ Dev environment stopped"
echo ""
echo "Production is still running:"
pm2 status | grep -E "rupiyame-backend|rupiyame-frontend" | grep -v dev
