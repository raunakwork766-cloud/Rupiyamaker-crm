#!/bin/bash

# Development setup script
echo "Setting up development environment..."

# Copy development environment files
cp backend/.env backend/.env.active 2>/dev/null || echo "Backend .env already active"
cp rupiyamaker-UI/crm/.env rupiyamaker-UI/crm/.env.active 2>/dev/null || echo "Frontend .env already active"

echo "Development environment configured!"
echo "Backend will run on: https://crm.fixyourfinance.ai/api"
echo "Frontend will run on: https://crm.fixyourfinance.ai"
echo ""
echo "To start the application:"
echo "1. Backend: cd backend && python -m app"
echo "2. Frontend: cd rupiyamaker-UI/crm && npm run dev"
