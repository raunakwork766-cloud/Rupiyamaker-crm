#!/bin/bash
# ============================================================
# RupiyaMe Production Backend — Permanent Startup Wrapper
# ============================================================
# PURPOSE:
#   Permanently prevents "Permission denied" crashes by auto-fixing
#   venv/bin execute permissions before every start — even if file
#   ownership or permissions are reset by a git pull, rsync, or
#   server reboot.
#
# ROOT CAUSE OF PAST CRASHES (documented):
#   - backend-dev: venv/bin/python was -rw-r--r-- (no +x) → 68 restarts
#   - If same happens to production venv after a deploy/rsync, it crashes too
#   - This wrapper is the permanent guard against that scenario
#
# SECONDARY PROTECTION:
#   - Validates the Python interpreter exists before starting
#   - Logs startup info to aid debugging
# ============================================================

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_BIN="$BACKEND_DIR/venv/bin"
PYTHON="$VENV_BIN/python"

echo "[startup] Production backend starting from: $BACKEND_DIR"
echo "[startup] Python path: $PYTHON"

# ── Fix: Ensure execute permissions on venv binaries ─────────
if [ ! -x "$PYTHON" ]; then
    echo "[startup] ⚠️  Python not executable — auto-fixing permissions on $VENV_BIN"
    chmod +x "$VENV_BIN"/* 2>/dev/null || true
    echo "[startup] ✅ Permissions fixed"
else
    echo "[startup] ✅ Python executable: OK"
fi

# ── Safety check ─────────────────────────────────────────────
if [ ! -x "$PYTHON" ]; then
    echo "[startup] ❌ FATAL: Cannot make Python executable."
    echo "[startup]    Check ownership: ls -la $VENV_BIN/python"
    echo "[startup]    Fix: chmod +x $VENV_BIN/*"
    exit 1
fi

# ── Start the backend ────────────────────────────────────────
echo "[startup] 🚀 Launching production backend..."
cd "$BACKEND_DIR"
exec "$PYTHON" -m app
