# Backend "Crash" Fix Summary

## Problem Identified
The backend was NOT actually crashing - it was being forcibly restarted every 5 minutes by a monitoring script.

## Root Cause
The cron job `*/5 * * * * /www/wwwroot/RupiyaMe/monitor-services.sh` was running every 5 minutes to check service health. However, the script had a bug where it was incorrectly detecting healthy services as down.

### The Bug
In `monitor-services.sh`, the grep command was returning multiple status values:
```bash
BACKEND_STATUS=$(echo "$PM2_LIST" | grep '"name":"rupiyame-backend"' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
```

This was returning: `'online\nonline'` (two "online" values separated by newline) instead of just `'online'`.

The condition `"$BACKEND_STATUS" != "online"` was therefore evaluating to TRUE, causing unnecessary restarts.

## The Fix
Added `| head -1` to extract only the first match:

```bash
BACKEND_STATUS=$(echo "$PM2_LIST" | grep '"name":"rupiyame-backend"' | grep -o '"status":"[^"]*"' | cut -d'"' -f4 | head -1)
FRONTEND_STATUS=$(echo "$PM2_LIST" | grep '"name":"rupiyame-frontend"' | grep -o '"status":"[^"]*"' | cut -d'"' -f4 | head -1)
```

## Evidence of the Problem

### PM2 Logs Showing Unnecessary Restarts
```
[2026-01-30 07:35:01] WARNING: Backend is 'online
online' - restarting...
[2026-01-30 07:35:01] WARNING: Frontend is 'online
online' - restarting...
```

Notice the status was `'online\nonline'` instead of just `'online'`.

### High Restart Count
- Backend: 154 restarts
- Frontend: 152 restarts

These restarts were accumulating every 5 minutes due to the monitoring script bug.

## Verification After Fix

### Correct Log Output
```
[2026-01-30 07:43:39] Backend is running normally
[2026-01-30 07:43:39] Frontend is running normally
```

### PM2 Status
```
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ rupiyame-backend   │ fork     │ 154  │ online    │ 0%       │ 120.8mb  │
│ 1  │ rupiyame-frontend  │ fork     │ 152  │ online    │ 0%       │ 35.2mb   │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

Both services are now stable and will not be unnecessarily restarted every 5 minutes.

## Additional Notes

### Other Findings
1. **MongoDB Index Errors**: The backend logs show index specification conflicts, but these are not causing crashes - they're logged during initialization attempts.

2. **No Actual Crashes**: There were no Python exceptions or actual crashes in the backend logs. The backend was processing requests normally between the forced restarts.

3. **Cron Job**: The monitoring script will continue to run every 5 minutes (via cron), but now it will correctly identify healthy services and only restart them when they're actually down.

## Impact
- **Before**: Services restarted every 5 minutes, causing intermittent downtime and user experience issues
- **After**: Services remain stable and are only restarted when genuinely needed

## Files Modified
- `monitor-services.sh`: Added `| head -1` to both BACKEND_STATUS and FRONTEND_STATUS extraction commands

## Monitoring
The cron job will continue to monitor services every 5 minutes and automatically restart them if they actually crash, which is the intended behavior.