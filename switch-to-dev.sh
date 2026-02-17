#!/bin/bash
# Quick branch checker and switcher

cd /www/wwwroot/RupiyaMe

# Kill any stuck git editor
pkill -9 vim 2>/dev/null
pkill -9 nano 2>/dev/null

# Check current branch
current=$(git branch --show-current 2>/dev/null)
echo "Current branch: $current"

# If not on dev, switch to dev
if [ "$current" != "dev" ]; then
    echo "Switching to dev branch..."
    GIT_EDITOR=true git checkout dev
    echo "✅ Switched to dev branch"
else
    echo "✅ Already on dev branch"
fi

# Show status
echo ""
echo "Git Status:"
git branch
echo ""
echo "✅ You are now on DEV branch"
echo "Production (main) is safe and separate"
