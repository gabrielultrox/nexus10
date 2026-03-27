import fs from 'node:fs'
import path from 'node:path'

const logDirectory = path.resolve(process.cwd(), 'backend', 'logs')

if (fs.existsSync(logDirectory)) {
  fs.rmSync(logDirectory, { recursive: true, force: true })
}

console.log('Backend logs cleaned.')
