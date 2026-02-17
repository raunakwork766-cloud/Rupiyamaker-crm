module.exports = {
  apps: [
    {
      name: 'rupiyame-backend-dev',
      cwd: '/www/wwwroot/RupiyaMe/backend',
      script: 'venv/bin/python',
      args: '-m app',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      env: {
        ENVIRONMENT: 'development',
        PYTHONUNBUFFERED: '1',
        DEV_PORT: '8051'  // Different port for dev
      },
      error_file: '/www/wwwroot/RupiyaMe/backend/logs/backend-dev-error.log',
      out_file: '/www/wwwroot/RupiyaMe/backend/logs/backend-dev-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    },
    {
      name: 'rupiyame-frontend-dev',
      cwd: '/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0 --port 4522',  // Different port for dev
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      env: {
        NODE_ENV: 'development',
        VITE_API_URL: 'http://localhost:8051',  // Point to dev backend
        DEV_PORT: '8051'  // Signal to vite config that this is dev environment
      },
      error_file: '/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/logs/frontend-dev-error.log',
      out_file: '/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/logs/frontend-dev-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};
