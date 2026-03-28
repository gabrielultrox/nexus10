import { runSchedulerCli } from './scheduler.js'

runSchedulerCli().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      message: 'Ze Delivery sync failed',
      error: error?.message ?? String(error),
    })}\n`,
  )
  process.exitCode = 1
})
