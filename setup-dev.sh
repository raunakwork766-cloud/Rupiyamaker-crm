#!/bin/bash

# Development setup script
echo "Setting up development environment..."

# Copy development environment files
cp backend/.env backend/.env.active 2>/dev/null || echo "Backend .env already active"
cp rupiyamaker-UI/crm/.env rupiyamaker-UI/crm/.env.active 2>/dev/null || echo "Frontend .env already active"

echo "Development environment configured!"
echo "Backend will run on: https://rupiyamaker.com:8049"
echo "Frontend will run on: https://raunakcrm.bhoomitechzone.us:4521"
echo ""
echo "To start the application:"
echo "1. Backend: cd backend && python -m app"
echo "2. Frontend: cd rupiyamaker-UI/crm && npm run dev"
