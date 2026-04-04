import { expect, type Page } from '@playwright/test'

const STORE_ID = 'hora-dez'

interface IE2EOptions {
  authenticated?: boolean
  operatorName?: string
}

function buildSession(operatorName = 'Gabriel') {
  return {
    uid: 'local-gabriel',
    email: null,
    displayName: operatorName,
    operatorName,
    isAnonymous: false,
    role: 'admin',
    roleLabel: 'Administrador',
    tenantId: STORE_ID,
    storeIds: [STORE_ID],
    defaultStoreId: STORE_ID,
    claims: {},
    permissions: {
      '*': true,
    },
  }
}

export function buildE2EState() {
  return {
    stores: {
      [STORE_ID]: {
        customers: [
          {
            id: 'customer-e2e-1',
            name: 'Cliente E2E',
            phone: '11999999999',
            phoneDisplay: '(11) 99999-9999',
            neighborhood: 'Centro',
            addressLine: 'Rua Teste, 123',
            reference: 'Porta azul',
          },
        ],
        products: [
          {
            id: 'product-e2e-1',
            name: 'Produto E2E 1',
            category: 'Bebidas',
            sku: 'E2E-001',
            barcode: '789000000001',
            price: 12.5,
            cost: 8,
            stock: 20,
            minimumStock: 2,
            status: 'active',
          },
          {
            id: 'product-e2e-2',
            name: 'Produto E2E 2',
            category: 'Snacks',
            sku: 'E2E-002',
            barcode: '789000000002',
            price: 9.9,
            cost: 5,
            stock: 18,
            minimumStock: 2,
            status: 'active',
          },
        ],
        orders: [],
        sales: [],
        zeDelivery: {
          settings: {
            enabled: true,
            intervalMinutes: 10,
            notificationsEnabled: false,
            notificationWebhookUrl: '',
          },
          logs: [
            {
              id: 'ze-log-seeded-success',
              storeId: STORE_ID,
              createdAt: new Date(Date.now() - 8 * 60_000).toISOString(),
              summary: {
                runId: 'run-seeded-success',
                processed: 12,
                created: 8,
                updated: 3,
                unchanged: 1,
                failed: 0,
                dryRun: false,
                trigger: 'scheduler',
                startedAt: new Date(Date.now() - 8 * 60_000).toISOString(),
                completedAt: new Date(Date.now() - 8 * 60_000).toISOString(),
                durationMs: 1800,
                success: true,
                error: null,
              },
            },
            {
              id: 'ze-log-seeded-error',
              storeId: STORE_ID,
              createdAt: new Date(Date.now() - 45 * 60_000).toISOString(),
              summary: {
                runId: 'run-seeded-error',
                processed: 4,
                created: 0,
                updated: 1,
                unchanged: 0,
                failed: 3,
                dryRun: false,
                trigger: 'manual',
                startedAt: new Date(Date.now() - 45 * 60_000).toISOString(),
                completedAt: new Date(Date.now() - 45 * 60_000).toISOString(),
                durationMs: 2900,
                success: false,
                error: {
                  code: 'ZE_SYNC_FAILURE',
                  message: 'Falha simulada na sincronizacao.',
                  stack: 'Mock stack trace',
                },
              },
            },
          ],
        },
      },
    },
    failures: {},
    counters: {
      order: 0,
      sale: 0,
      zeRun: 2,
    },
  }
}

export async function prepareE2EPage(page: Page, options: IE2EOptions = {}) {
  const authenticated = options.authenticated ?? false
  const operatorName = options.operatorName ?? 'Gabriel'
  const session = buildSession(operatorName)
  const state = buildE2EState()

  await page.addInitScript(
    ({ seededState, seededSession, enableAuth }) => {
      window.localStorage.setItem('nexus10.e2e.enabled', 'true')
      window.localStorage.setItem('nexus10.e2e.state', JSON.stringify(seededState))
      window.localStorage.setItem('nexus10.lastOperator', seededSession.operatorName)

      if (enableAuth) {
        window.localStorage.setItem('nexus10.localSession', JSON.stringify(seededSession))
      } else {
        window.localStorage.removeItem('nexus10.localSession')
      }
    },
    {
      seededState: state,
      seededSession: session,
      enableAuth: authenticated,
    },
  )
}

export async function setE2EFailures(page: Page, failures: Record<string, number>) {
  await page.evaluate((nextFailures) => {
    const rawState = window.localStorage.getItem('nexus10.e2e.state')
    const state = rawState ? JSON.parse(rawState) : {}

    state.failures = {
      ...(state.failures ?? {}),
      ...nextFailures,
    }

    window.localStorage.setItem('nexus10.e2e.state', JSON.stringify(state))
    window.dispatchEvent(new CustomEvent('nexus10:e2e-state-changed'))
  }, failures)
}

export async function loginViaUi(page: Page) {
  await page.goto('/login')
  await page.locator('.auth-pin__key', { hasText: '0' }).click()
  await page.locator('.auth-pin__key', { hasText: '1' }).first().click()
  await page.locator('.auth-pin__key', { hasText: '0' }).click()
  await page.locator('.auth-pin__key', { hasText: '1' }).first().click()
  await expect(page.getByLabel('Operador')).toBeVisible()
  await page.getByLabel('Operador').selectOption('Gabriel')
  await page.getByLabel('Senha').fill('01')
  await page.getByRole('button', { name: 'Entrar' }).click()
}

export async function openProductPicker(page: Page) {
  await page.getByRole('button', { name: /pesquisar produto/i }).click()
}
