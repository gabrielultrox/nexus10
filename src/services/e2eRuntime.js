const E2E_ENABLED_KEY = 'nexus10.e2e.enabled'
const E2E_STATE_KEY = 'nexus10.e2e.state'
const E2E_EVENT_NAME = 'nexus10:e2e-state-changed'
const DEFAULT_STORE_ID = 'hora-dez'

function isBrowser() {
  return typeof window !== 'undefined'
}

export function isE2eMode() {
  if (!isBrowser()) {
    return false
  }

  return window.localStorage.getItem(E2E_ENABLED_KEY) === 'true'
}

function createIsoDate(offsetMinutes = 0) {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString()
}

function createDefaultState() {
  return {
    stores: {
      [DEFAULT_STORE_ID]: {
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
              storeId: DEFAULT_STORE_ID,
              createdAt: createIsoDate(-8),
              summary: {
                runId: 'run-seeded-success',
                processed: 12,
                created: 8,
                updated: 3,
                unchanged: 1,
                failed: 0,
                dryRun: false,
                trigger: 'scheduler',
                startedAt: createIsoDate(-8),
                completedAt: createIsoDate(-8),
                durationMs: 1800,
                success: true,
                error: null,
              },
            },
            {
              id: 'ze-log-seeded-error',
              storeId: DEFAULT_STORE_ID,
              createdAt: createIsoDate(-45),
              summary: {
                runId: 'run-seeded-error',
                processed: 4,
                created: 0,
                updated: 1,
                unchanged: 0,
                failed: 3,
                dryRun: false,
                trigger: 'manual',
                startedAt: createIsoDate(-45),
                completedAt: createIsoDate(-45),
                durationMs: 2900,
                success: false,
                error: {
                  code: 'ZE_SYNC_FAILURE',
                  message: 'Falha simulada na sincronizacao.',
                  stack: 'Mock stack trace: ze-delivery-sync -> fetch-dashboard',
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

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeState(rawState) {
  const defaultState = createDefaultState()
  const nextState = rawState && typeof rawState === 'object' ? rawState : {}

  return {
    ...defaultState,
    ...nextState,
    stores: {
      ...defaultState.stores,
      ...(nextState.stores ?? {}),
    },
    failures: {
      ...(defaultState.failures ?? {}),
      ...(nextState.failures ?? {}),
    },
    counters: {
      ...defaultState.counters,
      ...(nextState.counters ?? {}),
    },
  }
}

function readState() {
  if (!isBrowser()) {
    return createDefaultState()
  }

  try {
    const rawState = window.localStorage.getItem(E2E_STATE_KEY)
    return normalizeState(rawState ? JSON.parse(rawState) : null)
  } catch {
    return createDefaultState()
  }
}

function writeState(nextState) {
  if (!isBrowser()) {
    return
  }

  window.localStorage.setItem(E2E_STATE_KEY, JSON.stringify(nextState))
  window.dispatchEvent(new CustomEvent(E2E_EVENT_NAME))
}

function getStoreState(state, storeId) {
  const nextStoreId = storeId ?? DEFAULT_STORE_ID

  if (!state.stores[nextStoreId]) {
    state.stores[nextStoreId] = {
      customers: [],
      products: [],
      orders: [],
      sales: [],
      zeDelivery: {
        settings: {
          enabled: true,
          intervalMinutes: 10,
          notificationsEnabled: false,
          notificationWebhookUrl: '',
        },
        logs: [],
      },
    }
  }

  return state.stores[nextStoreId]
}

function updateState(mutator) {
  const state = readState()
  mutator(state)
  writeState(state)
  return state
}

function subscribeToSlice(storeId, sliceKey, onData) {
  const emit = () => {
    const state = readState()
    const store = getStoreState(state, storeId)
    onData(clone(store[sliceKey] ?? []))
  }

  emit()

  if (!isBrowser()) {
    return () => {}
  }

  const handler = () => emit()
  window.addEventListener(E2E_EVENT_NAME, handler)
  return () => window.removeEventListener(E2E_EVENT_NAME, handler)
}

function nextCounter(state, key) {
  const current = Number(state.counters[key] ?? 0) + 1
  state.counters[key] = current
  return current
}

function consumeFailure(state, key) {
  const current = Number(state.failures[key] ?? 0)

  if (current <= 0) {
    return false
  }

  state.failures[key] = current - 1
  return true
}

function buildOrderRecord({ state, storeId, values }) {
  const store = getStoreState(state, storeId)
  const orderIndex = nextCounter(state, 'order')
  const orderId = `order-e2e-${orderIndex}`
  const customer = store.customers.find((entry) => entry.id === values.customerId) ??
    store.customers[0] ?? {
      id: null,
      name: 'Cliente avulso',
      phoneDisplay: '',
      neighborhood: '',
    }
  const items = (values.items ?? []).map((item, index) => {
    const product =
      store.products.find((entry) => entry.id === item.productId) ?? store.products[index] ?? null
    const quantity = Number(item.quantity ?? 1)
    const unitPrice = Number(item.unitPrice ?? product?.price ?? 0)

    return {
      productId: item.productId ?? product?.id ?? `product-${index + 1}`,
      productSnapshot: {
        id: product?.id ?? `product-${index + 1}`,
        name: product?.name ?? item.productSnapshot?.name ?? `Produto ${index + 1}`,
        category: product?.category ?? item.productSnapshot?.category ?? '',
        sku: product?.sku ?? item.productSnapshot?.sku ?? '',
      },
      quantity,
      unitPrice,
      totalPrice: Number((quantity * unitPrice).toFixed(2)),
    }
  })
  const subtotal = Number(
    items.reduce((total, item) => total + Number(item.totalPrice ?? 0), 0).toFixed(2),
  )
  const freight = Number(values.totals?.freight ?? 0)
  const extraAmount = Number(values.totals?.extraAmount ?? 0)
  const discountPercent = Number(values.totals?.discountPercent ?? 0)
  const discountValue =
    Number(values.totals?.discountValue ?? 0) ||
    Number((subtotal * (discountPercent / 100)).toFixed(2))
  const total = Number((subtotal + freight + extraAmount - discountValue).toFixed(2))
  const createdAt = createIsoDate()

  return {
    id: orderId,
    code: `PED-${String(orderIndex).padStart(4, '0')}`,
    number: `PED-${String(orderIndex).padStart(4, '0')}`,
    source: values.source ?? 'BALCAO',
    sourceChannel: values.source ?? 'BALCAO',
    customerId: customer.id,
    customerName: customer.name,
    customerSnapshot: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone ?? '',
      phoneDisplay: customer.phoneDisplay ?? '',
      neighborhood: customer.neighborhood ?? '',
    },
    paymentMethod: values.paymentMethod ?? 'PIX',
    paymentPreview: {
      method: values.paymentMethod ?? 'PIX',
      label: values.paymentMethod ?? 'PIX',
    },
    notes: values.notes ?? '',
    address: {
      neighborhood: values.address?.neighborhood ?? customer.neighborhood ?? '',
      addressLine: values.address?.addressLine ?? customer.addressLine ?? '',
      reference: values.address?.reference ?? customer.reference ?? '',
      complement: values.address?.complement ?? '',
    },
    items,
    totals: {
      subtotal,
      freight,
      extraAmount,
      discountPercent,
      discountValue,
      total,
    },
    total,
    domainStatus: 'OPEN',
    saleStatus: 'NOT_GENERATED',
    isExternal: false,
    priority: 'normal',
    createdAt,
    updatedAt: createdAt,
  }
}

function buildSaleRecord({ state, storeId, values }) {
  const store = getStoreState(state, storeId)
  const saleIndex = nextCounter(state, 'sale')
  const saleId = `sale-e2e-${saleIndex}`
  const customer = store.customers.find((entry) => entry.id === values.customerId) ??
    store.customers[0] ?? {
      id: null,
      name: 'Cliente avulso',
      phoneDisplay: '',
      neighborhood: '',
    }
  const items = (values.items ?? []).map((item, index) => {
    const product =
      store.products.find((entry) => entry.id === item.productId) ?? store.products[index] ?? null
    const quantity = Number(item.quantity ?? 1)
    const unitPrice = Number(item.unitPrice ?? product?.price ?? 0)

    return {
      productId: item.productId ?? product?.id ?? `product-${index + 1}`,
      productSnapshot: {
        id: product?.id ?? `product-${index + 1}`,
        name: product?.name ?? item.productSnapshot?.name ?? `Produto ${index + 1}`,
        category: product?.category ?? item.productSnapshot?.category ?? '',
        sku: product?.sku ?? item.productSnapshot?.sku ?? '',
      },
      quantity,
      unitPrice,
      totalPrice: Number((quantity * unitPrice).toFixed(2)),
      name: product?.name ?? item.productSnapshot?.name ?? `Produto ${index + 1}`,
      total: Number((quantity * unitPrice).toFixed(2)),
    }
  })
  const subtotal = Number(
    items.reduce((total, item) => total + Number(item.totalPrice ?? 0), 0).toFixed(2),
  )
  const freight = Number(values.totals?.freight ?? 0)
  const extraAmount = Number(values.totals?.extraAmount ?? 0)
  const discountPercent = Number(values.totals?.discountPercent ?? 0)
  const discountValue =
    Number(values.totals?.discountValue ?? 0) ||
    Number((subtotal * (discountPercent / 100)).toFixed(2))
  const total = Number((subtotal + freight + extraAmount - discountValue).toFixed(2))
  const createdAt = createIsoDate()
  const channel = values.channel ?? 'BALCAO'

  return {
    id: saleId,
    code: `VEN-${String(saleIndex).padStart(4, '0')}`,
    number: `VEN-${String(saleIndex).padStart(4, '0')}`,
    source: 'DIRECT',
    channel,
    channelLabel: channel,
    customerSnapshot: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone ?? '',
      phoneDisplay: customer.phoneDisplay ?? '',
      neighborhood: customer.neighborhood ?? '',
    },
    items,
    totals: {
      subtotal,
      freight,
      extraAmount,
      discountPercent,
      discountValue,
      total,
    },
    payment: {
      method: values.paymentMethod ?? 'PIX',
      label: values.paymentMethod ?? 'PIX',
      amount: total,
    },
    paymentMethod: values.paymentMethod ?? 'PIX',
    paymentMethodLabel: values.paymentMethod ?? 'PIX',
    subtotal,
    shipping: freight,
    discount: discountValue,
    total,
    domainStatus: 'POSTED',
    status: 'completed',
    stockPosted: true,
    financialPosted: true,
    createdAt,
    updatedAt: createdAt,
    createdAtDate: createdAt,
    updatedAtDate: createdAt,
    launchedAtDate: createdAt,
  }
}

function buildZeDeliveryDashboardRecord(storeId, store) {
  const logs = [...(store.zeDelivery?.logs ?? [])].sort(
    (left, right) =>
      new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime(),
  )
  const recentRuns = logs.slice(0, 20)
  const recentErrors = recentRuns.filter((log) => log.summary?.success === false)
  const lastRun = recentRuns[0] ?? null
  const totalRuns = recentRuns.length
  const successfulRuns = recentRuns.filter((log) => log.summary?.success !== false).length
  const deliveriesSynced = recentRuns.reduce(
    (total, log) => total + Number(log.summary?.processed ?? 0),
    0,
  )
  const totalDuration = recentRuns.reduce(
    (total, log) => total + Number(log.summary?.durationMs ?? 0),
    0,
  )
  const successRate = totalRuns ? Number(((successfulRuns / totalRuns) * 100).toFixed(1)) : null
  const failureRate = totalRuns
    ? Number((((totalRuns - successfulRuns) / totalRuns) * 100).toFixed(1))
    : 0
  const nextSync = store.zeDelivery?.settings?.enabled
    ? new Date(
        Date.now() + Number(store.zeDelivery?.settings?.intervalMinutes ?? 10) * 60_000,
      ).toISOString()
    : null
  const lastSync = lastRun?.createdAt ?? null
  const lastSyncError = recentErrors[0]?.summary?.error?.message ?? null

  return {
    summary: {
      status: store.zeDelivery?.settings?.enabled ? 'active' : 'paused',
      lastSync,
      nextSync,
      errorCount: recentErrors.length,
      successRate,
    },
    scheduler: {
      status: store.zeDelivery?.settings?.enabled ? 'active' : 'paused',
      lastSync,
      nextSync,
      errorCount: recentErrors.length,
      successRate,
      workers: [
        {
          id: 'worker-e2e-1',
          status: 'idle',
          storeId,
        },
      ],
    },
    recentErrors,
    recentRuns,
    stats24h: {
      deliveriesSynced,
      errors: recentErrors.length,
      averageDurationMs: totalRuns ? Math.round(totalDuration / totalRuns) : 0,
      failureRate,
      totalRuns,
    },
    stores: [
      {
        storeId,
        status: {
          lastSyncAt: lastSync,
          lastSyncSuccess: lastRun ? lastRun.summary?.success !== false : null,
          lastSyncError,
          counters: {
            created: recentRuns.reduce(
              (total, log) => total + Number(log.summary?.created ?? 0),
              0,
            ),
            updated: recentRuns.reduce(
              (total, log) => total + Number(log.summary?.updated ?? 0),
              0,
            ),
            unchanged: recentRuns.reduce(
              (total, log) => total + Number(log.summary?.unchanged ?? 0),
              0,
            ),
            failed: recentRuns.reduce((total, log) => total + Number(log.summary?.failed ?? 0), 0),
          },
        },
        settings: clone(store.zeDelivery?.settings ?? {}),
        recentOrders: [],
        recentLogs: recentRuns,
        stats24h: {
          deliveriesSynced,
          errors: recentErrors.length,
          averageDurationMs: totalRuns ? Math.round(totalDuration / totalRuns) : 0,
          failureRate,
          totalRuns,
        },
      },
    ],
  }
}

export function subscribeE2eCustomers(storeId, onData) {
  return subscribeToSlice(storeId, 'customers', onData)
}

export function subscribeE2eProducts(storeId, onData) {
  return subscribeToSlice(storeId, 'products', onData)
}

export function subscribeE2eOrders(storeId, onData) {
  return subscribeToSlice(storeId, 'orders', onData)
}

export function subscribeE2eSales(storeId, onData) {
  return subscribeToSlice(storeId, 'sales', onData)
}

export async function getE2eOrderById({ storeId, orderId }) {
  const state = readState()
  const store = getStoreState(state, storeId)
  return clone(store.orders.find((entry) => entry.id === orderId) ?? null)
}

export async function getE2eSaleById({ storeId, saleId }) {
  const state = readState()
  const store = getStoreState(state, storeId)
  return clone(store.sales.find((entry) => entry.id === saleId) ?? null)
}

export async function createE2eOrder({ storeId, values }) {
  let createdOrderId = null

  updateState((state) => {
    if (consumeFailure(state, 'createOrder')) {
      throw new Error('Falha simulada ao salvar o pedido.')
    }

    const store = getStoreState(state, storeId)
    const nextOrder = buildOrderRecord({ state, storeId, values })
    store.orders.unshift(nextOrder)
    createdOrderId = nextOrder.id
  })

  return createdOrderId
}

export async function createE2eSale({ storeId, values }) {
  let createdSaleId = null

  updateState((state) => {
    if (consumeFailure(state, 'createSale')) {
      throw new Error('Falha simulada ao lancar a venda.')
    }

    const store = getStoreState(state, storeId)
    const nextSale = buildSaleRecord({ state, storeId, values })
    store.sales.unshift(nextSale)
    createdSaleId = nextSale.id
  })

  return createdSaleId
}

export async function updateE2eSaleStatus({ storeId, saleId, status }) {
  updateState((state) => {
    const store = getStoreState(state, storeId)
    const target = store.sales.find((entry) => entry.id === saleId)

    if (!target) {
      throw new Error('Venda nao encontrada.')
    }

    target.domainStatus = status
    target.updatedAt = createIsoDate()
  })

  return saleId
}

export async function getE2eZeDeliveryDashboard({ storeId }) {
  const state = readState()
  const store = getStoreState(state, storeId ?? DEFAULT_STORE_ID)
  return clone(buildZeDeliveryDashboardRecord(storeId ?? DEFAULT_STORE_ID, store))
}

export async function updateE2eZeDeliverySettings(payload) {
  let nextSettings = null

  updateState((state) => {
    const store = getStoreState(state, payload.storeId)
    store.zeDelivery = store.zeDelivery ?? { settings: {}, logs: [] }
    store.zeDelivery.settings = {
      ...store.zeDelivery.settings,
      enabled: Boolean(payload.enabled),
      intervalMinutes: Number(payload.intervalMinutes ?? 10),
      notificationsEnabled: Boolean(payload.notificationsEnabled),
      notificationWebhookUrl: payload.notificationWebhookUrl ?? '',
    }
    nextSettings = clone(store.zeDelivery.settings)
  })

  return nextSettings
}

export async function triggerE2eZeDeliverySync({ storeId, dryRun = false, maxOrders = 100 }) {
  let nextLog = null

  updateState((state) => {
    const store = getStoreState(state, storeId)
    store.zeDelivery = store.zeDelivery ?? { settings: {}, logs: [] }
    const runIndex = nextCounter(state, 'zeRun')
    const failed = consumeFailure(state, 'zeDeliverySync')
    const createdAt = createIsoDate()

    nextLog = {
      id: `ze-log-${runIndex}`,
      storeId,
      createdAt,
      summary: {
        runId: `run-${runIndex}`,
        processed: failed ? 0 : Math.min(Number(maxOrders ?? 10), 7),
        created: failed ? 0 : 4,
        updated: failed ? 0 : 2,
        unchanged: failed ? 0 : 1,
        failed: failed ? 1 : 0,
        dryRun: Boolean(dryRun),
        trigger: 'manual',
        startedAt: createdAt,
        completedAt: createdAt,
        durationMs: failed ? 3100 : 1500,
        success: !failed,
        error: failed
          ? {
              code: 'ZE_SYNC_FAILURE',
              message: 'Falha simulada na sincronizacao do Ze Delivery.',
              stack: 'Mock stack trace: manual-sync -> sync-store',
            }
          : null,
      },
    }

    store.zeDelivery.logs.unshift(nextLog)
    store.zeDelivery.logs = store.zeDelivery.logs.slice(0, 30)
  })

  return clone(nextLog)
}
