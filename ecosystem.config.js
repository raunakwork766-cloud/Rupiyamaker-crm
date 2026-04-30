module.exports = {
  apps: [
    {
      name: 'rupiyame-backend',
      cwd: '/www/wwwroot/RupiyaMe/backend',
      script: 'venv/bin/python',
      args: '-m app',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1500M',  // Restart if exceeds 1.5GB (4 workers)

      // === Crash recovery (always restart, never give up) ===
      min_uptime: '30s',                  // Process must stay up 30s to be considered "stable"
      max_restarts: 1000,                 // Allow up to 1000 restart attempts (effectively unlimited)
      restart_delay: 4000,                // Wait 4s between restarts (avoid tight crash loop)
      exp_backoff_restart_delay: 200,     // Exponential backoff if it crashes repeatedly (200ms, 400ms, 800ms ... capped)
      kill_timeout: 15000,                // Give Python 15s to shut down gracefully before SIGKILL
      listen_timeout: 30000,              // Wait up to 30s for the app to be ready before declaring it failed
      wait_ready: false,                  // We do NOT use process.send('ready'); rely on listen_timeout

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
