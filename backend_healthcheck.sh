#!/bin/bash
# Healthcheck for rupiyame-backend — auto-restart if it stops responding
# Run via cron every 5 minutes

LOGFILE="/www/wwwroot/RupiyaMe/backend/logs/healthcheck.log"
MAX_LOG_LINES=500

check_backend() {
    local code
    code=$(curl -k --max-time 10 -s -o /dev/null -w "%{http_code}" https://localhost:8049/ 2>/dev/null)
    echo "$code"
}

# Get HTTP status code
STATUS=$(check_backend)

if [[ "$STATUS" == "200" || "$STATUS" == "404" || "$STATUS" == "403" || "$STATUS" == "401" ]]; then
    # Any response means server is alive
    exit 0
fi

# Server is not responding — log and restart
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$TIMESTAMP] Backend unresponsive (status=$STATUS). Restarting rupiyame-backend..." >> "$LOGFILE"

# Restart via PM2
pm2 restart rupiyame-backend >> "$LOGFILE" 2>&1

echo "[$TIMESTAMP] Restart triggered." >> "$LOGFILE"

# Keep log from growing indefinitely
if [[ -f "$LOGFILE" ]]; then
    tail -n "$MAX_LOG_LINES" "$LOGFILE" > "${LOGFILE}.tmp" && mv "${LOGFILE}.tmp" "$LOGFILE"
fi
