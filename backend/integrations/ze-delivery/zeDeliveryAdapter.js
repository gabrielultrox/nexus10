import fs from 'node:fs'
import path from 'node:path'

import { chromium } from 'playwright'

import {
  buildZeDeliveryDashboardUrl,
  ensureZeDeliverySessionDirectory,
  getZeDeliveryConfig,
} from '../../config/ze-delivery.js'
import { createLoggerContext, serializeError, withMethodLogging } from '../../logging/logger.js'

function sanitizeFileName(value) {
  return String(value).replace(/[^\w.-]+/g, '-')
}

function splitSelectorDefinition(definition) {
  const rawValue = String(definition ?? '').trim()

  if (!rawValue) {
    return {
      selector: '',
      attribute: null,
    }
  }

  const [selector, attribute] = rawValue.split('@@')
  return {
    selector: selector.trim(),
    attribute: attribute ? attribute.trim() : null,
  }
}

async function readLocatorValue(rootLocator, definition) {
  const { selector, attribute } = splitSelectorDefinition(definition)

  if (!selector) {
    return null
  }

  const locator = rootLocator.locator(selector).first()
  const count = await locator.count()

  if (!count) {
    return null
  }

  if (attribute) {
    const attributeValue = await locator.getAttribute(attribute)
    return attributeValue ? attributeValue.trim() : null
  }

  const textContent = await locator.textContent()
  return textContent ? textContent.trim() : null
}

export function createZeDeliveryAdapter({
  config = getZeDeliveryConfig(),
  browserFactory = (launchOptions) => chromium.launch(launchOptions),
} = {}) {
  const adapterLogger = createLoggerContext({
    module: 'integrations.ze-delivery.adapter',
  })

  let browserInstance = null
  let contextInstance = null
  let pageInstance = null

  async function ensureBrowser() {
    if (pageInstance) {
      return pageInstance
    }

    ensureZeDeliverySessionDirectory(config)

    browserInstance = await browserFactory({
      headless: config.browser.headless,
      channel: config.browser.channel,
    })

    contextInstance = await browserInstance.newContext({
      storageState: fs.existsSync(config.browser.sessionFilePath)
        ? config.browser.sessionFilePath
        : undefined,
      userAgent: config.browser.userAgent,
    })

    contextInstance.setDefaultTimeout(config.browser.timeoutMs)
    pageInstance = await contextInstance.newPage()
    return pageInstance
  }

  async function persistSession() {
    if (!contextInstance) {
      return
    }

    ensureZeDeliverySessionDirectory(config)
    await contextInstance.storageState({
      path: config.browser.sessionFilePath,
    })
  }

  async function captureFailureScreenshot(label) {
    if (!pageInstance) {
      return null
    }

    const directoryPath = path.resolve(process.cwd(), 'output', 'playwright')
    fs.mkdirSync(directoryPath, { recursive: true })
    const screenshotPath = path.join(
      directoryPath,
      `ze-delivery-${sanitizeFileName(label)}-${Date.now()}.png`,
    )

    await pageInstance.screenshot({
      path: screenshotPath,
      fullPage: true,
    })

    return screenshotPath
  }

  async function waitForTwoFactor(page) {
    if (!config.selectors.twoFactor) {
      return
    }

    const twoFactorLocator = page.locator(config.selectors.twoFactor).first()
    const visible = await twoFactorLocator.isVisible().catch(() => false)

    if (!visible) {
      return
    }

    await Promise.race([
      page.waitForSelector(config.selectors.afterLogin, {
        timeout: config.twoFactorTimeoutMs,
      }),
      twoFactorLocator.waitFor({
        state: 'hidden',
        timeout: config.twoFactorTimeoutMs,
      }),
    ])
  }

  async function performLogin(page) {
    await page.goto(config.urls.login, {
      waitUntil: 'domcontentloaded',
    })

    await page.fill(config.selectors.loginEmail, config.credentials.email)
    await page.fill(config.selectors.loginPassword, config.credentials.password)
    await page.click(config.selectors.loginSubmit)
    await waitForTwoFactor(page)
    await page.waitForSelector(config.selectors.afterLogin, {
      timeout: config.browser.timeoutMs,
    })
    await persistSession()
  }

  const ensureAuthenticated = withMethodLogging(
    {
      logger: adapterLogger,
      action: 'ze_delivery.ensure_authenticated',
    },
    async ({ storeId }) => {
      const page = await ensureBrowser()
      const dashboardUrl = buildZeDeliveryDashboardUrl(storeId, config)

      await page.goto(dashboardUrl, {
        waitUntil: 'domcontentloaded',
      })

      const loggedIn = await page
        .locator(config.selectors.afterLogin)
        .first()
        .isVisible()
        .catch(() => false)

      if (!loggedIn) {
        await performLogin(page)
        await page.goto(dashboardUrl, {
          waitUntil: 'domcontentloaded',
        })
      }

      await persistSession()
      return true
    },
  )

  const scrapeDeliveries = withMethodLogging(
    {
      logger: adapterLogger,
      action: 'ze_delivery.scrape_deliveries',
      getStartPayload: ({ storeId, maxOrders }) => ({
        storeId,
        maxOrders,
      }),
      getSuccessPayload: (result) => ({
        deliveryCount: result.deliveries.length,
      }),
    },
    async ({ storeId, maxOrders = config.sync.maxOrdersPerRun }) => {
      const page = await ensureBrowser()

      try {
        await ensureAuthenticated({ storeId })
        const dashboardUrl = buildZeDeliveryDashboardUrl(storeId, config)
        await page.goto(dashboardUrl, {
          waitUntil: 'networkidle',
        })
        await page.waitForSelector(config.selectors.orderRow, {
          timeout: config.browser.timeoutMs,
        })

        const rows = page.locator(config.selectors.orderRow)
        const rowCount = Math.min(await rows.count(), maxOrders)
        const deliveries = []

        for (let index = 0; index < rowCount; index += 1) {
          const row = rows.nth(index)
          const orderId = await readLocatorValue(row, config.selectors.orderId)
          const code = await readLocatorValue(row, config.selectors.code)
          const status = await readLocatorValue(row, config.selectors.status)
          const locationAddress = await readLocatorValue(row, config.selectors.location)
          const courierName = await readLocatorValue(row, config.selectors.courier)
          const scannedBy = await readLocatorValue(row, config.selectors.scannedBy)
          const timestamp = await readLocatorValue(row, config.selectors.timestamp)
          const latitudeValue = await readLocatorValue(row, config.selectors.lat)
          const longitudeValue = await readLocatorValue(row, config.selectors.lng)
          const rowText = (await row.textContent())?.trim() ?? ''

          deliveries.push({
            zeDeliveryId: orderId ?? code ?? `${storeId}-${index + 1}`,
            code: code ?? orderId ?? `${storeId}-${index + 1}`,
            status: status ?? 'unknown',
            rawStatus: status ?? 'unknown',
            timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
            location: {
              address: locationAddress ?? '',
              lat: latitudeValue != null && latitudeValue !== '' ? Number(latitudeValue) : null,
              lng: longitudeValue != null && longitudeValue !== '' ? Number(longitudeValue) : null,
            },
            courierName: courierName ?? null,
            scannedBy: scannedBy ?? null,
            originalData: {
              rowText,
              selectors: {
                orderId: config.selectors.orderId,
                code: config.selectors.code,
                status: config.selectors.status,
              },
            },
          })

          if (config.sync.requestDelayMs > 0 && index < rowCount - 1) {
            await page.waitForTimeout(config.sync.requestDelayMs)
          }
        }

        return {
          storeId,
          scrapedAt: new Date().toISOString(),
          deliveries,
        }
      } catch (error) {
        const screenshotPath = await captureFailureScreenshot(`scrape-${storeId}`).catch(() => null)
        adapterLogger.error(
          {
            context: 'ze_delivery.scrape.error',
            storeId,
            screenshotPath,
            error: serializeError(error),
          },
          'Failed to scrape Zé Delivery dashboard',
        )
        throw error
      }
    },
  )

  async function close() {
    await contextInstance?.close().catch(() => {})
    await browserInstance?.close().catch(() => {})
    contextInstance = null
    browserInstance = null
    pageInstance = null
  }

  return {
    ensureAuthenticated,
    scrapeDeliveries,
    close,
  }
}
