import { createBackendExternalOrderRepository } from '../../repositories/externalOrderRepository.js'
import { touchIntegrationMerchant } from '../../repositories/integrationMerchantRepository.js'

export function createIfoodFirestoreRepository() {
  const repository = createBackendExternalOrderRepository()

  return {
    hasProcessedEvent(storeId, eventId) {
      return repository.hasProcessedEvent(storeId, eventId)
    },
    upsertOrder({ storeId, tenantId, order }) {
      return repository.upsertOrder({ storeId, tenantId, order })
    },
    upsertEvent({ storeId, tenantId, event }) {
      return repository.upsertEvent({ storeId, tenantId, event })
    },
    upsertTracking({ storeId, tenantId, trackingEntry }) {
      return repository.upsertTracking({ storeId, tenantId, trackingEntry })
    },
    appendLog({ storeId, tenantId, log }) {
      return repository.appendLog({ storeId, tenantId, log })
    },
    upsertMerchant({ storeId, tenantId, merchantConfig }) {
      return touchIntegrationMerchant({
        storeId,
        merchantId: merchantConfig.merchantId,
        updates: {
          ...merchantConfig,
          tenantId: tenantId ?? null,
        },
      })
    },
  }
}
