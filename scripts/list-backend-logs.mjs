import fs from 'node:fs'
import path from 'node:path'

const logDirectory = path.resolve(process.cwd(), 'backend', 'logs')

if (!fs.existsSync(logDirectory)) {
  console.log('No backend log directory found.')
  process.exit(0)
}

const entries = fs
  .readdirSync(logDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort()

if (entries.length === 0) {
  console.log('No backend log files found.')
  process.exit(0)
}

entries.forEach((entry) => console.log(entry))
