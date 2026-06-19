#!/bin/bash
# ============================================================
# RupiyaMe Dev Backend - Permanent Startup Wrapper
# ============================================================
# Purpose:
#   1. Ensures venv/bin/* always has execute (+x) permissions before
#      starting the Python server. This prevents the recurring
#      "Permission denied" crash that caused 60+ PM2 restarts.
#   2. Runs the backend using the venv Python interpreter.
#
# Root cause of recurring crashes:
#   The backend-dev/venv/bin/ files were owned by 'www' user and
#   lacked execute permission (-rw-r--r-- instead of -rwxr-xr-x).
#   PM2 kept restarting the process which kept failing, causing
#   the high restart count seen in `pm2 list`.
# ============================================================

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_BIN="$BACKEND_DIR/venv/bin"
PYTHON="$VENV_BIN/python"

echo "[startup] Dev backend starting from: $BACKEND_DIR"

# ── Fix #1: Ensure execute permissions on venv binaries ─────
if [ ! -x "$PYTHON" ]; then
    echo "[startup] ⚠️  Python not executable — fixing permissions on $VENV_BIN"
    chmod +x "$VENV_BIN"/* 2>/dev/null || true
    echo "[startup] ✅ Permissions fixed"
else
    echo "[startup] ✅ Python executable: OK"
fi

# ── Fix #2: Verify Python is now executable ──────────────────
if [ ! -x "$PYTHON" ]; then
    echo "[startup] ❌ FATAL: Cannot make Python executable. Check file ownership."
    echo "[startup]    Run: chown -R root:root $VENV_BIN && chmod +x $VENV_BIN/*"
    exit 1
fi

# ── Start the backend ────────────────────────────────────────
echo "[startup] 🚀 Launching: $PYTHON -m app"
cd "$BACKEND_DIR"
exec "$PYTHON" -m app
