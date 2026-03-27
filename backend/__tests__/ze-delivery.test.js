import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getZeDeliveryConfig, resetZeDeliveryConfigCache } from '../config/ze-delivery.js'
import { requireZeDeliverySyncAuth } from '../middleware/ze-delivery-auth.js'
import { createZeDeliveryService } from '../integrations/ze-delivery/zeDeliveryService.js'

describe('Zé Delivery integration', () => {
  beforeEach(() => {
    resetZeDeliveryConfigCache()
    process.env.ZE_DELIVERY_ENABLED = 'true'
    process.env.ZE_DELIVERY_EMAIL = 'bot@example.com'
    process.env.ZE_DELIVERY_PASSWORD = 'secret'
    process.env.ZE_DELIVERY_LOGIN_URL = 'https://zedelivery.test/login'
    process.env.ZE_DELIVERY_DASHBOARD_URL_TEMPLATE = 'https://zedelivery.test/dashboard/{storeId}'
    process.env.ZE_DELIVERY_SYNC_TOKEN = 'super-secret-token'
  })

  it('valida configuracao obrigatoria quando integracao esta habilitada', () => {
    const config = getZeDeliveryConfig()

    expect(config.enabled).toBe(true)
    expect(config.credentials.email).toBe('bot@example.com')
    expect(config.urls.dashboardTemplate).toContain('{storeId}')
  })

  it('bloqueia requests sem token valido na middleware da integracao', () => {
    const request = {
      header: vi.fn(() => ''),
    }
    const response = {
      status: vi.fn(() => response),
      json: vi.fn(),
    }
    const next = vi.fn()

    requireZeDeliverySyncAuth(request, response, next)

    expect(response.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('aceita token valido na middleware da integracao', () => {
    const request = {
      header: vi.fn((name) => (name === 'x-ze-delivery-token' ? 'super-secret-token' : '')),
    }
    const response = {
      status: vi.fn(() => response),
      json: vi.fn(),
    }
    const next = vi.fn()

    requireZeDeliverySyncAuth(request, response, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(request.zeDeliveryAuth.provider).toBe('ze-delivery-script')
  })

  it('ingere entregas com deduplicacao por payload hash', async () => {
    const payloadHash = JSON.stringify({
      status: 'delivered',
      timestamp: '2026-03-27T10:00:00.000Z',
      scannedBy: 'Operador 1',
      courierName: 'Entregador 1',
      location: { address: 'Rua 1' },
      code: 'A123',
    })
    const repository = {
      getOrder: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        zeDeliveryId: 'ze-1',
        payloadHash,
      }),
      upsertOrder: vi.fn(),
      appendSyncLog: vi.fn(),
      setStoreStatus: vi.fn(),
    }

    const service = createZeDeliveryService({
      repository,
      adapter: { scrapeDeliveries: vi.fn(), close: vi.fn() },
      config: getZeDeliveryConfig(),
    })

    const result = await service.ingestScrapedOrders({
      storeId: 'store-1',
      deliveries: [
        {
          zeDeliveryId: 'ze-1',
          code: 'A123',
          status: 'delivered',
          timestamp: '2026-03-27T10:00:00.000Z',
          location: { address: 'Rua 1' },
          scannedBy: 'Operador 1',
          courierName: 'Entregador 1',
          originalData: {},
        },
        {
          zeDeliveryId: 'ze-1',
          code: 'A123',
          status: 'delivered',
          timestamp: '2026-03-27T10:00:00.000Z',
          location: { address: 'Rua 1' },
          scannedBy: 'Operador 1',
          courierName: 'Entregador 1',
          originalData: {},
        },
      ],
    })

    expect(result.created).toBe(1)
    expect(result.unchanged).toBe(1)
    expect(repository.upsertOrder).toHaveBeenCalledTimes(1)
    expect(repository.appendSyncLog).toHaveBeenCalledTimes(1)
    expect(repository.setStoreStatus).toHaveBeenCalledTimes(1)
  })

  it('executa scrape e sync manual com adapter integrado', async () => {
    const repository = {
      getOrder: vi.fn().mockResolvedValue(null),
      upsertOrder: vi.fn(),
      appendSyncLog: vi.fn(),
      setStoreStatus: vi.fn(),
      listStoreStatuses: vi.fn().mockResolvedValue([]),
      listOrders: vi.fn().mockResolvedValue([]),
      listSyncLogs: vi.fn().mockResolvedValue([]),
    }
    const adapter = {
      scrapeDeliveries: vi.fn().mockResolvedValue({
        scrapedAt: '2026-03-27T12:00:00.000Z',
        deliveries: [
          {
            zeDeliveryId: 'ze-2',
            code: 'B456',
            status: 'in_progress',
            timestamp: '2026-03-27T12:00:00.000Z',
            location: { address: 'Rua 2' },
            scannedBy: 'Operador 2',
            courierName: 'Entregador 2',
            originalData: {},
          },
        ],
      }),
      close: vi.fn(),
    }

    const service = createZeDeliveryService({
      repository,
      adapter,
      config: getZeDeliveryConfig(),
    })

    const result = await service.runScrapeAndSync({
      storeId: 'store-2',
      dryRun: true,
      maxOrders: 5,
    })

    expect(adapter.scrapeDeliveries).toHaveBeenCalledWith({
      storeId: 'store-2',
      maxOrders: 5,
    })
    expect(result.processed).toBe(1)
    expect(result.dryRun).toBe(true)
  })
})
