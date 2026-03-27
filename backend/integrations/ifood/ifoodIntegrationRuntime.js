import { createIfoodAdapter } from './ifoodAdapter.js'
import { createIfoodEventService } from './ifoodEventService.js'
import { createIfoodOrderService } from './ifoodOrderService.js'

export function createIfoodIntegrationRuntime({ env, repositories, fetchImpl = globalThis.fetch }) {
  const adapter = createIfoodAdapter({
    fetchImpl,
    config: {
      authBaseUrl: env.ifoodAuthBaseUrl,
      merchantBaseUrl: env.ifoodMerchantBaseUrl,
      pollingPath: env.ifoodEventsPollingPath,
      acknowledgmentPath: env.ifoodEventsAckPath,
      orderDetailsPath: env.ifoodOrderDetailsPath,
    },
  })

  const orderService = createIfoodOrderService({
    repositories,
  })

  const eventService = createIfoodEventService({
    adapter,
    orderService,
    repositories,
  })

  return {
    adapter,
    orderService,
    eventService,
  }
}
