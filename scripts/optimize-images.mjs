import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg'])
const DEFAULT_WIDTHS = [32, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1280]
const OUTPUT_DIRECTORY = path.join(projectRoot, 'public', 'optimized')
const SOURCE_DIRECTORY = path.join(projectRoot, 'public')
const MANIFEST_PATH = path.join(projectRoot, 'src', 'generated', 'image-manifest.json')

function toPosixPath(value) {
  return value.split(path.sep).join('/')
}

function getPublicUrl(absolutePath) {
  const relativePath = path.relative(path.join(projectRoot, 'public'), absolutePath)
  return `/${toPosixPath(relativePath)}`
}

function buildPlaceholderDataUri({ width = 16, height = 16, red = 15, green = 23, blue = 42 }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><filter id="b" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="1.1"/></filter><rect width="100%" height="100%" fill="rgb(${red}, ${green}, ${blue})" filter="url(#b)"/></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

async function collectSourceImages(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name)

    if (absolutePath.startsWith(OUTPUT_DIRECTORY)) {
      continue
    }

    if (entry.isDirectory()) {
      files.push(...(await collectSourceImages(absolutePath)))
      continue
    }

    const extension = path.extname(entry.name).toLowerCase()

    if (SUPPORTED_EXTENSIONS.has(extension)) {
      files.push(absolutePath)
    }
  }

  return files
}

async function ensureDirectory(directory) {
  await fs.mkdir(directory, { recursive: true })
}

function getResponsiveWidths(sourceWidth) {
  const widths = DEFAULT_WIDTHS.filter((width) => width < sourceWidth)
  return Array.from(new Set([...widths, sourceWidth])).sort((left, right) => left - right)
}

async function writeVariant({ sourcePath, targetPath, width, format }) {
  const transformer = sharp(sourcePath).rotate().resize({ width, withoutEnlargement: true })

  if (format === 'avif') {
    await transformer.avif({ quality: 54, effort: 6 }).toFile(targetPath)
    return
  }

  if (format === 'webp') {
    await transformer.webp({ quality: 74, effort: 6 }).toFile(targetPath)
    return
  }

  const extension = path.extname(sourcePath).toLowerCase()

  if (extension === '.png') {
    await transformer.png({ compressionLevel: 9, palette: true }).toFile(targetPath)
    return
  }

  await transformer.jpeg({ quality: 78, mozjpeg: true }).toFile(targetPath)
}

function buildSrcSet(variants) {
  return variants.map((variant) => `${variant.src} ${variant.width}w`).join(', ')
}

export async function optimizeImageAssets({ silent = false } = {}) {
  await ensureDirectory(OUTPUT_DIRECTORY)
  await ensureDirectory(path.dirname(MANIFEST_PATH))

  const sourceFiles = await collectSourceImages(SOURCE_DIRECTORY)
  const manifest = {}

  for (const sourcePath of sourceFiles) {
    const metadata = await sharp(sourcePath).metadata()

    if (!metadata.width || !metadata.height) {
      continue
    }

    const stats = await sharp(sourcePath).stats()
    const dominant = stats.dominant ?? { r: 15, g: 23, b: 42 }
    const widths = getResponsiveWidths(metadata.width)
    const relativeSourceDirectory = path.dirname(path.relative(SOURCE_DIRECTORY, sourcePath))
    const fileName = path.basename(sourcePath, path.extname(sourcePath))
    const extension = path.extname(sourcePath).toLowerCase()
    const outputSubdirectory = path.join(OUTPUT_DIRECTORY, relativeSourceDirectory)

    await ensureDirectory(outputSubdirectory)

    const avifVariants = []
    const webpVariants = []
    const fallbackVariants = []

    for (const width of widths) {
      const avifPath = path.join(outputSubdirectory, `${fileName}-w${width}.avif`)
      const webpPath = path.join(outputSubdirectory, `${fileName}-w${width}.webp`)
      const fallbackPath = path.join(outputSubdirectory, `${fileName}-w${width}${extension}`)

      await Promise.all([
        writeVariant({ sourcePath, targetPath: avifPath, width, format: 'avif' }),
        writeVariant({ sourcePath, targetPath: webpPath, width, format: 'webp' }),
        writeVariant({ sourcePath, targetPath: fallbackPath, width, format: extension }),
      ])

      avifVariants.push({ width, src: getPublicUrl(avifPath) })
      webpVariants.push({ width, src: getPublicUrl(webpPath) })
      fallbackVariants.push({ width, src: getPublicUrl(fallbackPath) })
    }

    const largestFallback = fallbackVariants[fallbackVariants.length - 1]
    const sourceKey = toPosixPath(path.relative(SOURCE_DIRECTORY, sourcePath))

    manifest[sourceKey] = {
      alt: fileName.replace(/[-_]+/g, ' '),
      width: metadata.width,
      height: metadata.height,
      sizes: '(max-width: 768px) 100vw, 512px',
      placeholder: buildPlaceholderDataUri({
        width: Math.max(8, Math.round(metadata.width / 24)),
        height: Math.max(8, Math.round(metadata.height / 24)),
        red: dominant.r,
        green: dominant.g,
        blue: dominant.b,
      }),
      fallbackSrc: largestFallback?.src ?? getPublicUrl(sourcePath),
      avifSrcSet: buildSrcSet(avifVariants),
      webpSrcSet: buildSrcSet(webpVariants),
      fallbackSrcSet: buildSrcSet(fallbackVariants),
      variants: {
        avif: avifVariants,
        webp: webpVariants,
        fallback: fallbackVariants,
      },
    }
  }

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2))

  if (!silent) {
    const totalFiles = Object.keys(manifest).length
    const filesAboveTarget = []

    for (const sourceKey of Object.keys(manifest)) {
      const largestVariant = manifest[sourceKey].variants.fallback.at(-1)

      if (!largestVariant) {
        continue
      }

      const variantPath = path.join(projectRoot, 'public', largestVariant.src.replace(/^\//, ''))
      const { size } = await fs.stat(variantPath)

      if (size > 100 * 1024) {
        filesAboveTarget.push({ sourceKey, size })
      }
    }

    console.log(`Optimized ${totalFiles} raster image(s).`)

    if (filesAboveTarget.length) {
      console.warn('Images above 100KB after optimization:')
      filesAboveTarget.forEach((file) => {
        console.warn(`- ${file.sourceKey}: ${(file.size / 1024).toFixed(1)} KB`)
      })
    }
  }

  return manifest
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)

if (isDirectExecution) {
  optimizeImageAssets().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
