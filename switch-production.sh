#!/bin/bash
# Switch Production to Main Branch

echo "======================================"
echo "Switching Production to Main Branch"
echo "======================================"

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" == "main" ]; then
    echo "✓ Already on main branch"
else
    echo "Switching to main branch..."
    git checkout main
fi

echo ""
echo "Restarting production services..."
pm2 restart rupiyame-backend rupiyame-frontend

echo ""
echo "======================================"
echo "✓ Production Running on Main Branch"
echo "======================================"
echo ""
pm2 status | grep -E "rupiyame-backend|rupiyame-frontend" | grep -v dev
