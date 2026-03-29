import cron from 'node-cron'

import { logger, serializeError } from '../logging/logger.js'
import { writeDailyBackupAuditReport } from '../services/backupMonitor.js'

const schedulerLogger = logger.child({ context: 'backup.scheduler' })

async function runBackupAudit() {
  try {
    const result = await writeDailyBackupAuditReport()

    schedulerLogger.info(
      {
        result,
      },
      'Daily backup audit completed',
    )

    return result
  } catch (error) {
    schedulerLogger.error(
      {
        error: serializeError(error),
      },
      'Daily backup audit failed',
    )
    throw error
  }
}

let scheduledTask: cron.ScheduledTask | null = null

function stopScheduler() {
  scheduledTask?.stop()
  scheduledTask = null
}

async function main() {
  if (process.argv.includes('--once')) {
    await runBackupAudit()
    process.exit(0)
  }

  scheduledTask = cron.schedule(
    '0 3 * * *',
    () => {
      runBackupAudit().catch(() => {})
    },
    {
      timezone: 'America/Sao_Paulo',
    },
  )

  schedulerLogger.info(
    {
      cron: '0 3 * * *',
      timezone: 'America/Sao_Paulo',
    },
    'Backup audit scheduler started',
  )
}

process.on('SIGINT', () => {
  stopScheduler()
  process.exit(0)
})

process.on('SIGTERM', () => {
  stopScheduler()
  process.exit(0)
})

main().catch(async (error) => {
  schedulerLogger.error(
    {
      error: serializeError(error),
    },
    'Backup audit scheduler failed during bootstrap',
  )
  process.exit(1)
})
