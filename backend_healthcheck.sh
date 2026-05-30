#!/bin/bash
# Healthcheck for rupiyame-backend — auto-restart if it stops responding
# Run via cron every 5 minutes

# Ensure PM2 / node is on PATH (cron uses a minimal PATH by default)
export PATH="/www/server/nodejs/v22.21.1/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
PM2_BIN="$(command -v pm2 || echo /www/server/nodejs/v22.21.1/bin/pm2)"

LOGFILE="/www/wwwroot/RupiyaMe/backend/logs/healthcheck.log"
MAX_LOG_LINES=500
CONSEC_FILE="/tmp/.rupiyame-backend-healthcheck-consecutive-fails"

check_backend() {
    # Try HTTPS first, then HTTP fallback. Any HTTP-style response (1xx-5xx) means the server is alive.
    local code
    code=$(curl -k --max-time 10 -s -o /dev/null -w "%{http_code}" https://localhost:8049/ 2>/dev/null)
    if [[ "$code" == "000" ]]; then
        code=$(curl --max-time 10 -s -o /dev/null -w "%{http_code}" http://localhost:8049/ 2>/dev/null)
    fi
    echo "$code"
}

STATUS=$(check_backend)

# Treat ANY non-zero HTTP status as alive (even 5xx — process is up, just erroring)
if [[ "$STATUS" != "000" && "$STATUS" != "" ]]; then
    # Reset consecutive-fail counter
    rm -f "$CONSEC_FILE"
    exit 0
fi

# Track consecutive failures — only restart after 2 consecutive failures (~10 minutes)
# to avoid restarting on transient blips.
FAILS=0
[[ -f "$CONSEC_FILE" ]] && FAILS=$(cat "$CONSEC_FILE" 2>/dev/null || echo 0)
FAILS=$((FAILS + 1))
echo "$FAILS" > "$CONSEC_FILE"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

if [[ "$FAILS" -lt 2 ]]; then
    echo "[$TIMESTAMP] Backend unresponsive (status=$STATUS), consecutive fails=$FAILS — waiting before restart" >> "$LOGFILE"
else
    echo "[$TIMESTAMP] Backend unresponsive (status=$STATUS) for $FAILS checks. Restarting rupiyame-backend..." >> "$LOGFILE"
    "$PM2_BIN" restart rupiyame-backend --update-env >> "$LOGFILE" 2>&1
    echo "[$TIMESTAMP] Restart triggered." >> "$LOGFILE"
    rm -f "$CONSEC_FILE"
fi

# Keep log from growing indefinitely
if [[ -f "$LOGFILE" ]]; then
    tail -n "$MAX_LOG_LINES" "$LOGFILE" > "${LOGFILE}.tmp" && mv "${LOGFILE}.tmp" "$LOGFILE"
fi
