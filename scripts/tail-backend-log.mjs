import fs from 'node:fs'
import path from 'node:path'

const logDirectory = path.resolve(process.cwd(), 'backend', 'logs')

if (!fs.existsSync(logDirectory)) {
  console.log('No backend log directory found.')
  process.exit(0)
}

const logFiles = fs
  .readdirSync(logDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort()

const latestLogFile = logFiles.at(-1)

if (!latestLogFile) {
  console.log('No backend log files found.')
  process.exit(0)
}

const logFilePath = path.join(logDirectory, latestLogFile)
let lastSize = 0

function printNewContent() {
  const stats = fs.statSync(logFilePath)

  if (stats.size <= lastSize) {
    return
  }

  const stream = fs.createReadStream(logFilePath, {
    start: lastSize,
    end: stats.size,
    encoding: 'utf8',
  })

  stream.pipe(process.stdout)
  lastSize = stats.size
}

console.log(`Tailing ${logFilePath}`)
printNewContent()
fs.watchFile(logFilePath, { interval: 500 }, printNewContent)
