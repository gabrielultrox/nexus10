import { execSync } from 'node:child_process'

function run(command, options = {}) {
  execSync(command, {
    stdio: 'inherit',
    ...options,
  })
}

const commitMessage = process.argv.slice(2).join(' ').trim()

if (!commitMessage) {
  console.error('Uso: npm run release:auto -- "mensagem do commit"')
  process.exit(1)
}

run('npm run lint')
run('npm run build')
run('git add -A')

const status = execSync('git status --short', { encoding: 'utf8' }).trim()

if (!status) {
  console.log('Nada novo para commitar.')
  process.exit(0)
}

run(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`)
run('git push origin main')

console.log('Push concluido. A Vercel deve publicar automaticamente a partir do GitHub.')
