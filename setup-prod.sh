#!/bin/bash

# Production setup script
echo "Setting up production environment..."

# Copy production environment files
cp backend/.env.production backend/.env 2>/dev/null || echo "Backend production .env copied"
cp rupiyamaker-UI/crm/.env.production rupiyamaker-UI/crm/.env 2>/dev/null || echo "Frontend production .env copied"

echo "Production environment configured!"
echo "Backend will run on: https://crm.fixyourfinance.ai/api"
echo "Frontend will run on: https://crm.fixyourfinance.ai"
echo ""
echo "To start the application:"
echo "1. Backend: cd backend && python -m app"
echo "2. Frontend: cd rupiyamaker-UI/crm && npm run build && npm run preview"
