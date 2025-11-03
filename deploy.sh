#!/bin/bash

# Rupiyamaker Docker Deployment Script
# This script builds and deploys the Rupiyamaker CRM application with automatic SSL
# Uses custom ports since 80/443 are already in use

set -e

echo "========================================="
echo "🚀 Rupiyamaker Docker Deployment Script"
echo "========================================="

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  This script should be run as root or with sudo for proper SSL certificate generation."
    echo "   Example: sudo ./deploy.sh"
    exit 1
fi

# Configuration
DOMAIN="crm.rupiyamakercrm.online"
CONTAINER_NAME="rupiyamaker"
EMAIL="admin@bhoomi.cloud"
HTTP_PORT="5902"
HTTPS_PORT="5903"
BACKEND_PORT="8049"

echo "📋 Deployment Configuration:"
echo "   Domain: $DOMAIN"
echo "   Container: $CONTAINER_NAME"
echo "   Frontend HTTP Port: $HTTP_PORT"
echo "   Frontend HTTPS Port: $HTTPS_PORT (once SSL is configured)"
echo "   Backend API Port: $BACKEND_PORT"
echo "   SSL Auto-renewal: Every 30 days"
echo ""
echo "⚠️  Note: Using custom ports since 80/443 are already in use"
echo ""

# Check if ports are available
echo "🔍 Checking port availability..."
for port in $HTTP_PORT $HTTPS_PORT $BACKEND_PORT; do
    if ss -tuln | grep ":$port " > /dev/null; then
        echo "❌ Port $port is already in use. Please stop the service using it or choose different ports."
        exit 1
    else
        echo "✅ Port $port is available"
    fi
done

# Stop existing container if running
echo "🔄 Stopping existing containers..."
docker-compose down 2>/dev/null || true
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Clean up old images (optional)
read -p "🗑️  Do you want to remove old Docker images? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧹 Cleaning up old Docker images..."
    docker image prune -f
fi

# Create necessary directories
mkdir -p ./logs
mkdir -p ./backend/media
chmod 755 ./logs

# Build the Docker image
echo "🔨 Building Docker image..."
docker-compose build

# Check if the domain resolves to this server
echo "🌐 Checking domain resolution..."
if ! nslookup $DOMAIN &> /dev/null; then
    echo "⚠️  Warning: Domain $DOMAIN does not resolve. Make sure your DNS is configured correctly."
    echo "   Point $DOMAIN to this server's IP address."
    echo ""
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Start the services
echo "🚀 Starting Rupiyamaker services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 15

# Check service health
echo "🏥 Checking service health..."
for i in {1..12}; do
    if docker exec $CONTAINER_NAME curl -f http://localhost:$HTTP_PORT/health >/dev/null 2>&1; then
        echo "✅ Frontend service is healthy"
        break
    fi
    if [ $i -eq 12 ]; then
        echo "❌ Frontend service failed to start properly"
        echo "📋 Container logs:"
        docker logs $CONTAINER_NAME --tail 30
        exit 1
    fi
    echo "   Attempt $i/12 - waiting..."
    sleep 10
done

for i in {1..12}; do
    if docker exec $CONTAINER_NAME curl -f http://localhost:$BACKEND_PORT/health >/dev/null 2>&1; then
        echo "✅ Backend service is healthy"
        break
    fi
    if [ $i -eq 12 ]; then
        echo "❌ Backend service failed to start properly"
        echo "📋 Container logs:"
        docker logs $CONTAINER_NAME --tail 30
        exit 1
    fi
    echo "   Attempt $i/12 - waiting..."
    sleep 10
done

# Check external connectivity
echo "🌍 Testing external connectivity..."
sleep 5
EXTERNAL_IP=$(curl -s ifconfig.me || curl -s icanhazip.com)
echo "   Server IP: $EXTERNAL_IP"

# Final status check
echo ""
echo "========================================="
echo "✅ Deployment Completed Successfully!"
echo "========================================="
echo ""
echo "🌐 Application URLs:"
echo "   Frontend (HTTP):    http://$DOMAIN:$HTTP_PORT"
echo "   Frontend (HTTPS):   https://$DOMAIN:$HTTPS_PORT (once SSL is ready)"
echo "   Backend API:        https://$DOMAIN:$BACKEND_PORT"
echo "   Local Access:       http://localhost:$HTTP_PORT"
echo ""
echo "📊 Container Status:"
docker ps | grep $CONTAINER_NAME
echo ""
echo "🔒 SSL Certificate Info:"
echo "   - SSL certificates will be automatically obtained"
echo "   - Auto-renewal every 30 days via cron"
echo "   - Check logs: docker logs $CONTAINER_NAME | grep SSL"
echo ""
echo "📋 Useful Commands:"
echo "   View logs:          docker logs $CONTAINER_NAME -f"
echo "   Stop services:      docker-compose down"
echo "   Restart services:   docker-compose restart"
echo "   Update deployment:  ./deploy.sh"
echo "   Shell access:       docker exec -it $CONTAINER_NAME bash"
echo ""
echo "🔧 Port Information:"
echo "   Frontend HTTP:  $HTTP_PORT (mapped to container port $HTTP_PORT)"
echo "   Frontend HTTPS: $HTTPS_PORT (mapped to container port $HTTPS_PORT)"
echo "   Backend API:    $BACKEND_PORT (mapped to container port $BACKEND_PORT)"
echo ""
echo "🎉 Your Rupiyamaker CRM is now running!"
echo "========================================="
