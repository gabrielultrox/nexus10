import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const tokensPath = path.join(rootDir, 'src', 'design', 'tokens.json')
const cssPath = path.join(rootDir, 'src', 'design', 'tokens.css')

const requiredPaths = [
  'color.palette.red.500',
  'color.palette.orange.500',
  'color.palette.yellow.500',
  'color.palette.green.500',
  'color.palette.blue.500',
  'color.palette.purple.500',
  'color.palette.gray.100',
  'color.semantic.success',
  'background.page',
  'text.primary',
  'border.medium',
  'typography.fontFamily.sans',
  'typography.fontSize.base',
  'typography.fontWeight.regular',
  'spacing.scale.4',
  'radius.md',
  'shadow.md',
  'breakpoint.tablet',
  'theme.dark.background.page',
  'theme.light.background.page',
  'theme.amber.background.page',
]

function readTokens() {
  return JSON.parse(fs.readFileSync(tokensPath, 'utf8'))
}

function getByPath(source, targetPath) {
  return targetPath.split('.').reduce((current, segment) => current?.[segment], source)
}

function resolveTokenValue(value, source, seen = new Set()) {
  if (typeof value !== 'string') {
    return String(value)
  }

  const match = value.match(/^\{(.+)\}$/)
  if (!match) {
    return value
  }

  const tokenPath = match[1]

  if (seen.has(tokenPath)) {
    throw new Error(`Referencia circular detectada: ${tokenPath}`)
  }

  const token = getByPath(source, tokenPath)

  if (!token || typeof token !== 'object' || !('$value' in token)) {
    throw new Error(`Referencia invalida em tokens.json: ${tokenPath}`)
  }

  seen.add(tokenPath)
  return resolveTokenValue(token.$value, source, seen)
}

function flattenTokens(source, branch = [], output = []) {
  Object.entries(source).forEach(([key, value]) => {
    if (!value || typeof value !== 'object') {
      return
    }

    if ('$value' in value) {
      output.push({
        name: branch.concat(key).join('-'),
        value: resolveTokenValue(value.$value, readTokens()),
      })
      return
    }

    flattenTokens(value, branch.concat(key), output)
  })

  return output
}

function validateTokens(tokens) {
  const missing = requiredPaths.filter((targetPath) => !getByPath(tokens, targetPath))

  if (missing.length > 0) {
    throw new Error(`Tokens obrigatorios ausentes: ${missing.join(', ')}`)
  }

  const flattened = flattenTokens(tokens)

  if (flattened.length === 0) {
    throw new Error('Nenhum token resolvido em tokens.json.')
  }
}

function buildThemeAliasBlock(mode) {
  return [
    `:root[data-theme='${mode}'] {`,
    `  --bg-base: var(--token-theme-${mode}-background-page);`,
    `  --bg-surface: var(--token-theme-${mode}-background-surface);`,
    `  --bg-elevated: var(--token-theme-${mode}-background-elevated);`,
    `  --text-primary: var(--token-theme-${mode}-text-primary);`,
    `  --text-secondary: var(--token-theme-${mode}-text-secondary);`,
    `  --text-muted: var(--token-theme-${mode}-text-muted);`,
    `  --border-subtle: var(--token-theme-${mode}-border-light);`,
    `  --border: var(--token-theme-${mode}-border-medium);`,
    `  --accent: var(--token-color-palette-blue-500);`,
    `  --success: var(--token-color-semantic-success);`,
    `  --warning: var(--token-color-semantic-warning);`,
    `  --danger: var(--token-color-semantic-error);`,
    `  --info: var(--token-color-semantic-info);`,
    `  --accent-dim: color-mix(in srgb, var(--accent) 12%, transparent);`,
    `}`,
    '',
  ].join('\n')
}

function buildCss(tokens) {
  const flattened = flattenTokens(tokens)
  const tokenLines = flattened.map((token) => `  --token-${token.name}: ${token.value};`)

  return [
    '/* Auto-generated from src/design/tokens.json. Do not edit manually. */',
    ':root {',
    ...tokenLines,
    '  --font-display: var(--token-typography-fontFamily-display);',
    '  --font-title: var(--token-typography-fontFamily-display);',
    '  --font-sans: var(--token-typography-fontFamily-sans);',
    '  --font-mono: var(--token-typography-fontFamily-mono);',
    '  --font-body: var(--token-typography-fontFamily-sans);',
    '  --space-0: var(--token-spacing-scale-0);',
    '  --space-1: var(--token-spacing-scale-1);',
    '  --space-2: var(--token-spacing-scale-2);',
    '  --space-3: var(--token-spacing-scale-3);',
    '  --space-4: var(--token-spacing-scale-4);',
    '  --space-5: var(--token-spacing-scale-5);',
    '  --space-6: var(--token-spacing-scale-6);',
    '  --space-7: var(--token-spacing-scale-7);',
    '  --space-8: var(--token-spacing-scale-8);',
    '  --radius-xs: var(--token-radius-sm);',
    '  --radius-base: var(--token-radius-md);',
    '  --radius-sm: var(--token-radius-lg);',
    '  --radius-md: var(--token-radius-lg);',
    '  --radius-lg: var(--token-radius-lg);',
    '  --radius-pill: var(--token-radius-full);',
    '  --shadow-sm: var(--token-shadow-sm);',
    '  --shadow-md: var(--token-shadow-md);',
    '  --shadow-lg: var(--token-shadow-lg);',
    '  --shadow-xl: var(--token-shadow-xl);',
    '}',
    '',
    buildThemeAliasBlock('dark'),
    buildThemeAliasBlock('light'),
    buildThemeAliasBlock('amber'),
  ].join('\n')
}

function main() {
  const tokens = readTokens()
  validateTokens(tokens)
  const nextCss = buildCss(tokens)
  const shouldCheck = process.argv.includes('--check')

  if (shouldCheck) {
    const currentCss = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : ''

    if (currentCss !== nextCss) {
      throw new Error('src/design/tokens.css esta desatualizado. Rode npm run tokens:build.')
    }

    console.log('Design tokens validados.')
    return
  }

  fs.writeFileSync(cssPath, nextCss)
  console.log(`Design tokens gerados em ${path.relative(rootDir, cssPath)}.`)
}

main()
