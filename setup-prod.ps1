# Production setup script for Windows
Write-Host "Setting up production environment..."

# Copy production environment files
if (Test-Path "backend\.env.production") {
    Copy-Item "backend\.env.production" "backend\.env" -Force
    Write-Host "Backend production .env copied"
} else {
    Write-Host "Backend .env.production not found" -ForegroundColor Red
}

if (Test-Path "rupiyamaker-UI\crm\.env.production") {
    Copy-Item "rupiyamaker-UI\crm\.env.production" "rupiyamaker-UI\crm\.env" -Force
    Write-Host "Frontend production .env copied"
} else {
    Write-Host "Frontend .env.production not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "Production environment configured!" -ForegroundColor Green
Write-Host "Backend will run on: https://rupiyamaker.com:8049" -ForegroundColor Cyan
Write-Host "Frontend will run on: https://raunakcrm.bhoomitechzone.us:4521" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the application:" -ForegroundColor Yellow
Write-Host "1. Backend: cd backend; python -m app" -ForegroundColor White
Write-Host "2. Frontend: cd rupiyamaker-UI\crm; npm run build; npm run preview" -ForegroundColor White
