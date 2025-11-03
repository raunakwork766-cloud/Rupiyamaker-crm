#!/bin/bash

# SSL Certificate Renewal Script for Rupiyamaker CRM
# Runs automatically every 30 days via cron
# Works with custom ports since 80/443 are in use

set -e

# Configuration
DOMAIN="crm.rupiyamakercrm.online"
EMAIL="admin@bhoomi.cloud"
LOG_FILE="/var/log/ssl-renew.log"
HTTP_PORT="5902"
HTTPS_PORT="5903"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log "Starting SSL certificate renewal process for $DOMAIN"

# Check if certificates exist
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log "SSL certificates not found. Running initial certificate generation..."
    
    # For initial setup, we need to use standalone mode on custom ports
    # Stop nginx temporarily
    service nginx stop || true
    
    # Wait a moment
    sleep 2
    
    # Generate initial certificates using standalone mode on available port
    certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN" \
        --http-01-port 8080 \
        --verbose
    
    if [ $? -eq 0 ]; then
        log "Initial SSL certificates generated successfully"
        
        # Start nginx
        service nginx start
        
        # Test nginx configuration
        nginx -t
        if [ $? -eq 0 ]; then
            log "Nginx configuration is valid"
            service nginx reload
        else
            log "ERROR: Nginx configuration test failed"
            exit 1
        fi
    else
        log "ERROR: Failed to generate initial SSL certificates"
        service nginx start || true
        exit 1
    fi
else
    log "Existing certificates found. Attempting renewal..."
    
    # For renewal, use webroot method if possible, otherwise standalone
    if [ -d "/app/frontend/dist" ]; then
        # Try webroot renewal
        certbot renew \
            --webroot \
            --webroot-path=/app/frontend/dist \
            --quiet \
            --no-self-upgrade
    else
        # Fallback to standalone renewal
        service nginx stop || true
        sleep 2
        
        certbot renew \
            --standalone \
            --http-01-port 8080 \
            --quiet \
            --no-self-upgrade
        
        service nginx start
    fi
    
    if [ $? -eq 0 ]; then
        log "SSL certificates renewed successfully"
        
        # Test nginx configuration
        nginx -t
        if [ $? -eq 0 ]; then
            log "Nginx configuration is valid, reloading..."
            service nginx reload
            log "Nginx reloaded successfully"
        else
            log "ERROR: Nginx configuration test failed after renewal"
            exit 1
        fi
    else
        log "Certificate renewal not needed or failed"
    fi
fi

# Check certificate expiry
CERT_FILE="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [ -f "$CERT_FILE" ]; then
    EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$CERT_FILE" | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
    CURRENT_EPOCH=$(date +%s)
    DAYS_UNTIL_EXPIRY=$(( (EXPIRY_EPOCH - CURRENT_EPOCH) / 86400 ))
    
    log "Certificate expires on: $EXPIRY_DATE"
    log "Days until expiry: $DAYS_UNTIL_EXPIRY"
    
    if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
        log "WARNING: Certificate expires in less than 30 days!"
    else
        log "Certificate is valid for $DAYS_UNTIL_EXPIRY more days"
    fi
fi

# Health check on both ports
log "Performing health checks..."

# Check HTTP port
curl -f "http://$DOMAIN:$HTTP_PORT/health" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    log "HTTP health check passed (port $HTTP_PORT)"
else
    log "WARNING: HTTP health check failed (port $HTTP_PORT)"
fi

# Check HTTPS port
curl -f -k "https://$DOMAIN:$HTTPS_PORT/health" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    log "HTTPS health check passed (port $HTTPS_PORT)"
else
    log "WARNING: HTTPS health check failed (port $HTTPS_PORT)"
fi

# Cleanup old logs (keep only last 30 days)
find /var/log/letsencrypt/ -name "*.log" -mtime +30 -delete 2>/dev/null || true

log "SSL certificate renewal process completed"
