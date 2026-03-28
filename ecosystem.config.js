const schedulerApp = {
  name: 'nexus10-ze-delivery-sync',
  script: './scripts/scheduler.js',
  instances: 2,
  exec_mode: 'cluster',
  watch: true,
  ignore_watch: ['logs', 'tmp', 'node_modules', 'dist', 'dist-backend', '.git'],
  autorestart: true,
  max_memory_restart: '500M',
  exp_backoff_restart_delay: 1000,
  restart_delay: 5000,
  min_uptime: '60s',
  max_restarts: 5,
  cron_restart: '*/5 * * * *',
  kill_timeout: 15000,
  merge_logs: true,
  out_file: './logs/pm2-ze-delivery-out.log',
  error_file: './logs/pm2-ze-delivery-error.log',
  env: {
    NODE_ENV: process.env.NODE_ENV || 'production',
    ZE_DELIVERY_WORKER_COUNT: process.env.ZE_DELIVERY_WORKER_COUNT || '2',
    ZE_DELIVERY_SYNC_INTERVAL_MINUTES: process.env.ZE_DELIVERY_SYNC_INTERVAL_MINUTES || '5',
  },
}

const ecosystem = {
  apps: [schedulerApp],
}

if (typeof module !== 'undefined') {
  module.exports = ecosystem
}

export default ecosystem
