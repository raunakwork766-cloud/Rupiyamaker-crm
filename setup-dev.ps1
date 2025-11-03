# Development setup script for Windows
Write-Host "Setting up development environment..."

# Copy development environment files  
if (Test-Path "backend\.env") {
    Copy-Item "backend\.env" "backend\.env.active" -ErrorAction SilentlyContinue
    Write-Host "Backend .env is active"
} else {
    Write-Host "Backend .env not found"
}

if (Test-Path "rupiyamaker-UI\crm\.env") {
    Copy-Item "rupiyamaker-UI\crm\.env" "rupiyamaker-UI\crm\.env.active" -ErrorAction SilentlyContinue
    Write-Host "Frontend .env is active"
} else {
    Write-Host "Frontend .env not found"
}

Write-Host ""
Write-Host "Development environment configured!" -ForegroundColor Green
Write-Host "Backend will run on: https://rupiyamaker.com:8049" -ForegroundColor Cyan
Write-Host "Frontend will run on: https://raunakcrm.bhoomitechzone.us:4521" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the application:" -ForegroundColor Yellow
Write-Host "1. Backend: cd backend; python -m app" -ForegroundColor White
Write-Host "2. Frontend: cd rupiyamaker-UI\crm; npm run dev" -ForegroundColor White
