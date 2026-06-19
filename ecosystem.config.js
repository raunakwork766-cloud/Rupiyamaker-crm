module.exports = {
  apps: [
    {
      name: 'rupiyame-backend',
      cwd: '/www/wwwroot/RupiyaMe/backend',
      // Use wrapper script instead of direct venv/bin/python.
      // The wrapper auto-fixes execute permissions on venv/bin/* before every
      // launch — permanently prevents "Permission denied" crashes that can occur
      // after git pulls, rsync deploys, or server reboots reset file permissions.
      script: '/www/wwwroot/RupiyaMe/backend/start_backend.sh',
      args: '',
      interpreter: 'bash',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1200M',  // 2 uvicorn workers (~200MB each) + master + headroom = ~600MB typical

      // === Crash recovery (always restart, never give up) ===
      min_uptime: '30s',                  // Process must stay up 30s to be considered "stable"
      max_restarts: 1000,                 // Allow up to 1000 restart attempts (effectively unlimited)
      restart_delay: 4000,                // Wait 4s between restarts (avoid tight crash loop)
      exp_backoff_restart_delay: 200,     // Exponential backoff if it crashes repeatedly
      kill_timeout: 35000,                // Give Python 35s to shut down gracefully (matches graceful_shutdown 30s + buffer)
      listen_timeout: 30000,              // Wait up to 30s for the app to be ready
      wait_ready: false,

      env: {
        ENVIRONMENT: 'production',
        PYTHONUNBUFFERED: '1'
      },
      error_file: '/www/wwwroot/RupiyaMe/backend/logs/backend-error.log',
      out_file: '/www/wwwroot/RupiyaMe/backend/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    },
    {
      name: 'rupiyame-frontend',
      cwd: '/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0 --port 4521',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: '4521'
      },
      error_file: '/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/logs/frontend-error.log',
      out_file: '/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};
