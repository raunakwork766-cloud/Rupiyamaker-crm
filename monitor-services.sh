#!/bin/bash
# Service Monitor Script - Auto-restart backend if PM2 reports it down
# This script runs every 5 minutes to ensure services are always running

export PATH="/www/server/nodejs/v22.21.1/bin:/www/server/nodejs/v24.11.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

LOG_FILE="/www/wwwroot/RupiyaMe/service-monitor.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
APP_DIR="/www/wwwroot/RupiyaMe"
if [ -x /www/server/nodejs/v22.21.1/bin/pm2 ]; then
    PM2_BIN="/www/server/nodejs/v22.21.1/bin/pm2"
else
    PM2_BIN="$(command -v pm2 || echo /www/server/nodejs/v24.11.0/bin/pm2)"
fi
MAX_LOG_LINES=500

log_message() {
    echo "[$TIMESTAMP] $1" >> "$LOG_FILE"
}

# Check if PM2 is running
if ! command -v "$PM2_BIN" &> /dev/null; then
    log_message "ERROR: PM2 not found in PATH"
    exit 1
fi

# Get PM2 process list
PM2_LIST=$("$PM2_BIN" jlist 2>/dev/null)

get_status() {
    local name="$1"
    python3 -c '
import json
import sys

target = sys.argv[1]
raw = sys.stdin.read()
start = raw.find("[{")
if start == -1:
    start = raw.find("[")

try:
    processes = json.loads(raw[start:] if start != -1 else raw)
except Exception:
    processes = []

for process in processes:
    if process.get("name") == target:
        print(process.get("pm2_env", {}).get("status", ""))
        break
' "$name" <<< "$PM2_LIST" 2>/dev/null
}

# Check backend status
BACKEND_STATUS=$(get_status "rupiyame-backend")

if [ -z "$BACKEND_STATUS" ]; then
    log_message "WARNING: rupiyame-backend missing from PM2 - starting from ecosystem.config.js..."
    cd "$APP_DIR" || exit 1
    "$PM2_BIN" start ecosystem.config.js --only rupiyame-backend --update-env >> "$LOG_FILE" 2>&1
    "$PM2_BIN" save --force >> "$LOG_FILE" 2>&1
    log_message "Backend start attempted from ecosystem config"
elif [ "$BACKEND_STATUS" != "online" ]; then
    log_message "WARNING: Backend is '$BACKEND_STATUS' - restarting..."
    "$PM2_BIN" restart rupiyame-backend --update-env >> "$LOG_FILE" 2>&1
    log_message "Backend restart attempted"
fi

# If the production frontend process exists, keep it online too. Do not spam
# logs when only the dev frontend is configured on this server.
FRONTEND_STATUS=$(get_status "rupiyame-frontend")

if [ -n "$FRONTEND_STATUS" ] && [ "$FRONTEND_STATUS" != "online" ]; then
    log_message "WARNING: Frontend is '$FRONTEND_STATUS' - restarting..."
    "$PM2_BIN" restart rupiyame-frontend --update-env >> "$LOG_FILE" 2>&1
    log_message "Frontend restart attempted"
fi

# If no processes found at all, start from ecosystem config
PROCESS_COUNT=$(echo "$PM2_LIST" | grep -c '"name"')
if [ "$PROCESS_COUNT" -eq 0 ]; then
    log_message "CRITICAL: No PM2 processes found - starting from ecosystem.config.js..."
    cd "$APP_DIR" || exit 1
    "$PM2_BIN" start ecosystem.config.js >> "$LOG_FILE" 2>&1
    "$PM2_BIN" save --force >> "$LOG_FILE" 2>&1
    log_message "Services started from ecosystem config"
fi

if [ -f "$LOG_FILE" ]; then
    tail -n "$MAX_LOG_LINES" "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi
