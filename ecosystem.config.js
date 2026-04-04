const backupSchedulerApp = {
  name: 'nexus10-backup-audit',
  script: './dist-backend/backend/scripts/backupScheduler.js',
  instances: 1,
  exec_mode: 'fork',
  watch: true,
  ignore_watch: ['logs', 'tmp', 'node_modules', 'dist', 'dist-backend', '.git'],
  autorestart: true,
  max_memory_restart: '300M',
  exp_backoff_restart_delay: 1000,
  restart_delay: 5000,
  min_uptime: '60s',
  max_restarts: 5,
  kill_timeout: 15000,
  merge_logs: true,
  out_file: './logs/pm2-backup-audit-out.log',
  error_file: './logs/pm2-backup-audit-error.log',
  env: {
    NODE_ENV: process.env.NODE_ENV || 'production',
  },
}

const ecosystem = {
  apps: [backupSchedulerApp],
}

if (typeof module !== 'undefined') {
  module.exports = ecosystem
}

export default ecosystem
