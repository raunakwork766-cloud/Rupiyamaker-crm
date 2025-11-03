#!/bin/bash

# Deployment script for Rupiyamaker CRM with auto-generated SSL certificates
# Domain: crm.rupiyamakercrm.online
# Ports: 5902 (HTTP), 5903 (HTTPS), 8049 (Backend)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Configuration
DOMAIN="crm.rupiyamakercrm.online"
HTTP_PORT="5902"
BACKEND_PORT="8049"
CONTAINER_NAME="rupiyamaker"

log "🚀 Starting Rupiyamaker CRM deployment (Development Mode)..."
log "📋 Configuration:"
log "   Domain: $DOMAIN"
log "   Frontend (Dev): $HTTP_PORT"
log "   Backend Port: $BACKEND_PORT"
log "   Container: $CONTAINER_NAME"
log "   Mode: Development with npm run dev"

# Check if required files exist
log "🔍 Checking required files..."

# Generate SSL certificate and key if not present
if [ ! -f "ssl.crt" ] || [ ! -f "ssl.key" ]; then
    log "🔑 Generating self-signed SSL certificate and key..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl.key -out ssl.crt \
        -subj "/C=IN/ST=State/L=City/O=Rupiyamaker/OU=IT/CN=$DOMAIN"
    if [ $? -eq 0 ]; then
        success "SSL certificate and key generated successfully."
    else
        error "Failed to generate SSL certificate and key!"
        exit 1
    fi
else
    success "SSL certificate and key already exist."
fi

if [ ! -f "docker-compose.yml" ]; then
    error "docker-compose.yml not found!"
    exit 1
fi

success "All required files found"

# Check if ports are available (except 80/443 which we know are in use)
log "🔍 Checking port availability..."

for port in $HTTP_PORT $BACKEND_PORT; do
    if netstat -tuln | grep -q ":$port "; then
        warning "Port $port is already in use. This might cause conflicts."
    else
        success "Port $port is available"
    fi
done

# Check Docker
log "🐳 Checking Docker..."

if ! command -v docker &> /dev/null; then
    error "Docker is not installed!"
    exit 1
fi

if ! docker info &> /dev/null; then
    error "Docker daemon is not running!"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose is not installed!"
    exit 1
fi

success "Docker and Docker Compose are ready"

# Stop existing container if running
if docker ps -a --format 'table {{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    log "🛑 Stopping existing container..."
    docker-compose down
    success "Existing container stopped"
fi

# Build and start the application
log "🔨 Building and starting the application..."

# Build the Docker image
log "📦 Building Docker image..."
docker-compose build

if [ $? -eq 0 ]; then
    success "Docker image built successfully"
else
    error "Failed to build Docker image"
    exit 1
fi

# Start the application
log "🚀 Starting the application..."
docker-compose up -d

if [ $? -eq 0 ]; then
    success "Application started successfully"
else
    error "Failed to start the application"
    exit 1
fi

# Wait for services to be ready
log "⏳ Waiting for services to be ready..."
sleep 10

# Check container status
log "🔍 Checking container status..."
if docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -q "$CONTAINER_NAME.*Up"; then
    success "Container is running"
else
    error "Container is not running properly"
    log "Container logs:"
    docker-compose logs --tail=50
    exit 1
fi

# Health checks
log "🏥 Performing health checks..."

# Check HTTP endpoint (Vite dev server)
if curl -f -s http://localhost:$HTTP_PORT > /dev/null 2>&1; then
    success "Frontend development server is responding"
else
    warning "Frontend development server health check failed (this is normal if the application is still starting)"
fi

# Check backend endpoint
if curl -f -s -k https://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
    success "Backend API is responding"
else
    warning "Backend API health check failed (this is normal if the application is still starting)"
fi

# Display final information
echo ""
log "🎉 Deployment completed successfully!"
echo ""
echo "==============================================="
echo "🌐 ACCESS INFORMATION"
echo "==============================================="
echo "Frontend (DEV):    http://$DOMAIN:$HTTP_PORT"
echo "Backend API:       https://$DOMAIN:$BACKEND_PORT"
echo "Local Frontend:    http://localhost:$HTTP_PORT"
echo "Local Backend:     https://localhost:$BACKEND_PORT"
echo "==============================================="
echo "📋 DEVELOPMENT MODE"
echo "==============================================="
echo "Frontend:          Vite development server"
echo "Hot reload:        Enabled"
echo "Source maps:       Available"
echo "==============================================="
echo "📋 MANAGEMENT COMMANDS"
echo "==============================================="
echo "View logs:         docker-compose logs -f"
echo "Stop application:  docker-compose down"
echo "Restart:           docker-compose restart"
echo "Rebuild:           docker-compose build --no-cache"
echo "==============================================="

# Show recent logs
log "📝 Recent application logs:"
docker-compose logs --tail=20

echo ""
success "Deployment script completed!"
