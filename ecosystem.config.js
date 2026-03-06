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
      min_uptime: '10s',
      max_restarts: 10,
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
