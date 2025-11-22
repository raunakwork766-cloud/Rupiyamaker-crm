# RupiyaMe PM2 Service Management

## Services Running

Both frontend and backend are now running as PM2 services and will automatically restart:
- On crashes
- On server reboot
- When memory limit is exceeded

### Service Details

#### Backend Service
- **Name**: `rupiyame-backend`
- **Port**: 8049 (HTTPS)
- **Location**: `/www/wwwroot/RupiyaMe/backend`
- **Technology**: Python FastAPI with Uvicorn
- **Max Memory**: 2GB

#### Frontend Service
- **Name**: `rupiyame-frontend`
- **Port**: 4521
- **Location**: `/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm`
- **Technology**: Vite + React
- **Max Memory**: 1GB

## Quick Commands

### Using the Management Script

```bash
cd /www/wwwroot/RupiyaMe

# Check status
./pm2-manage.sh status

# View all logs
./pm2-manage.sh logs

# View backend logs only
./pm2-manage.sh logs rupiyame-backend

# View frontend logs only
./pm2-manage.sh logs rupiyame-frontend

# Restart all services
./pm2-manage.sh restart

# Restart backend only
./pm2-manage.sh restart rupiyame-backend

# Restart frontend only
./pm2-manage.sh restart rupiyame-frontend

# Stop all services
./pm2-manage.sh stop

# Start all services
./pm2-manage.sh start

# Open monitoring dashboard
./pm2-manage.sh monitor

# Get detailed info
./pm2-manage.sh info rupiyame-backend
```

### Direct PM2 Commands

```bash
PM2=/www/server/nodejs/v22.21.1/bin/pm2

# View status
$PM2 status

# View logs
$PM2 logs

# Restart a service
$PM2 restart rupiyame-backend
$PM2 restart rupiyame-frontend

# Stop a service
$PM2 stop rupiyame-backend

# Start a service
$PM2 start rupiyame-backend

# Delete a service
$PM2 delete rupiyame-backend

# Restart all
$PM2 restart all

# Save configuration
$PM2 save

# Monitor
$PM2 monit

# Show detailed info
$PM2 show rupiyame-backend
```

## Log Locations

- Backend logs: `/www/wwwroot/RupiyaMe/backend/logs/`
  - `backend-out.log` - Standard output
  - `backend-error.log` - Error output
  
- Frontend logs: `/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/logs/`
  - `frontend-out.log` - Standard output
  - `frontend-error.log` - Error output

## Configuration File

The PM2 configuration is stored in: `/www/wwwroot/RupiyaMe/ecosystem.config.js`

To modify configuration:
1. Edit `ecosystem.config.js`
2. Restart services: `./pm2-manage.sh restart`
3. Save: `./pm2-manage.sh save`

## Auto-Startup on Reboot

PM2 is configured to automatically start on system reboot.

To check startup configuration:
```bash
systemctl status pm2-root
```

To disable auto-startup:
```bash
/www/server/nodejs/v22.21.1/bin/pm2 unstartup
```

To re-enable auto-startup:
```bash
/www/server/nodejs/v22.21.1/bin/pm2 startup
/www/server/nodejs/v22.21.1/bin/pm2 save
```

## Troubleshooting

### Service won't start
```bash
# Check logs
./pm2-manage.sh logs rupiyame-backend

# Try manual start
cd /www/wwwroot/RupiyaMe/backend
source venv/bin/activate
python -m app
```

### Port already in use
```bash
# Check what's using the port
netstat -tlnp | grep 8049
netstat -tlnp | grep 4521

# Kill the process if needed
kill -9 <PID>
```

### High memory usage
```bash
# Check memory usage
./pm2-manage.sh status

# Restart if needed
./pm2-manage.sh restart rupiyame-backend
```

### Reset PM2
```bash
PM2=/www/server/nodejs/v22.21.1/bin/pm2

# Stop all
$PM2 stop all

# Delete all
$PM2 delete all

# Restart from config
cd /www/wwwroot/RupiyaMe
$PM2 start ecosystem.config.js

# Save
$PM2 save
```

## URLs

- Frontend: http://your-domain:4521
- Backend API: https://your-domain:8049
- Backend Docs: https://your-domain:8049/docs

## Notes

- Services automatically restart on crash
- Services automatically start on server reboot
- Logs are automatically rotated by PM2
- Zero-downtime reload available with: `./pm2-manage.sh reload`
