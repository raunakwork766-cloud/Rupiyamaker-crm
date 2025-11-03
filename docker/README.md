# Rupiyamaker CRM - Docker Deployment

This directory contains Docker configuration files for deploying the Rupiyamaker CRM application with existing SSL certificates.

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- SSL certificates (`ssl.crt` and `ssl.key`) in the project root
- Ports 5902, 5903, and 8049 available

### Deploy with Test Domain (crm.rupiyamakercrm.online)

```bash
# Make deployment script executable
chmod +x deploy-test.sh

# Run deployment
./deploy-test.sh
```

### Manual Deployment

```bash
# Build and start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

## Access Information

- **Frontend (HTTP):** http://crm.rupiyamakercrm.online:5902
- **Frontend (HTTPS):** https://raunakcrm.bhoomitechzone.us:5903
- **Backend API:** https://rupiyamaker.com:8049
- **Local Access:** http://localhost:5902

## Configuration

The application uses the following ports:
- `5902` - Frontend HTTP
- `5903` - Frontend HTTPS
- `8049` - Backend API

### Environment Variables

The following environment variables are configured in `docker-compose.yml`:

- `DOMAIN=crm.rupiyamakercrm.online` - Domain name
- `HTTP_PORT=5902` - HTTP port for frontend
- `HTTPS_PORT=5903` - HTTPS port for frontend  
- `BACKEND_PORT=8049` - Backend API port
- `USE_EXISTING_SSL=true` - Use existing SSL certificates

## SSL Certificates

The application is configured to use existing SSL certificates:
- `ssl.crt` - SSL certificate (mounted to `/etc/ssl/certs/ssl.crt`)
- `ssl.key` - SSL private key (mounted to `/etc/ssl/private/ssl.key`)

## File Structure

```
docker/
├── Dockerfile          # Main application container
├── nginx.conf          # Nginx configuration
├── entrypoint.sh       # Container startup script
└── ssl-renew.sh        # SSL renewal script (not used with existing certs)

docker-compose.yml      # Docker Compose configuration
deploy-test.sh          # Automated deployment script
```

## Monitoring and Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f rupiyamaker

# Check container status
docker-compose ps

# Access container shell
docker-compose exec rupiyamaker bash
```

## Troubleshooting

### Port Conflicts
If you encounter port conflicts, update the ports in `docker-compose.yml`:

```yaml
ports:
  - "5902:5902"   # Change first number to available port
  - "5903:5903"   # Change first number to available port
  - "8049:8049"   # Change first number to available port
```

### SSL Certificate Issues
Ensure SSL certificates exist in the project root:

```bash
ls -la ssl.*
# Should show ssl.crt and ssl.key
```

### Health Check Failures
Check if services are running:

```bash
# Test HTTP endpoint
curl -f http://localhost:5902/health

# Test HTTPS endpoint  
curl -f -k https://localhost:5903/health

# Test backend endpoint
curl -f -k https://localhost:8049/health
```

## Container Management

```bash
# Restart services
docker-compose restart

# Rebuild and restart
docker-compose build --no-cache && docker-compose up -d

# Stop and remove containers
docker-compose down

# Stop and remove containers with volumes
docker-compose down -v

# View resource usage
docker stats rupiyamaker
```

## Production Considerations

1. **Reverse Proxy:** Consider using a reverse proxy like Traefik or another Nginx instance for production
2. **SSL Management:** Implement proper SSL certificate management for production
3. **Monitoring:** Add monitoring and alerting for production deployments
4. **Backups:** Implement backup strategies for persistent data
5. **Security:** Review and harden security settings for production use
